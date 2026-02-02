// Order item types for the enhanced ordering flow
// Each item represents ONE unit (no quantity field in storage)
// Items have individual statuses: pending, preparing, ready, rejected

export interface OrderItemOption {
  groupName: string;
  label: string;
  price: number;
}

// Item structure stored in database (single unit)
export interface StoredOrderItem {
  item_id: string;
  menu_item_id: string;
  name: string;
  price: number;
  options: OrderItemOption[];
  status: 'pending' | 'preparing' | 'ready' | 'rejected';
  created_at: string;
  category_name?: string;
  special_request?: string; // Per-round special request note
}

// Item structure in local cart (with quantity for UI convenience)
export interface CartItem {
  id: string; // local unique ID
  menu_item_id: string;
  name: string;
  quantity: number;
  price_usd: number;
  options?: OrderItemOption[];
  notes?: string;
}

// Active order from tb_order_temporary
export interface ActiveOrder {
  id: string;
  shop_id: string;
  device_id: string;
  status: 'placed' | 'preparing' | 'ready' | 'paid';
  total_usd: number;
  customer_notes: string | null;
  items: StoredOrderItem[];
  order_type: 'dine_in' | 'takeaway';
  table_id: string | null;
  table_number: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

// Shop info returned with active order
export interface ShopInfo {
  name: string;
  currency: string;
  logo_url: string | null;
}

// Grouped items for display (group by name + options + status)
export interface GroupedOrderItem {
  name: string;
  options: OrderItemOption[];
  price: number;
  status: 'pending' | 'preparing' | 'ready' | 'rejected';
  count: number;
  item_ids: string[];
  created_at: string; // earliest created_at in the group
  category_name?: string;
}

// Round (order placement) structure - items grouped by creation time
export interface OrderRound {
  roundNumber: number;
  timestamp: string;
  items: StoredOrderItem[];
  specialRequest: string | null;
}

// Helper to group stored items for display
export function groupOrderItems(items: StoredOrderItem[]): GroupedOrderItem[] {
  const groups: Map<string, GroupedOrderItem> = new Map();

  for (const item of items) {
    // Create a key based on name + options + status
    const optionsKey = JSON.stringify(item.options || []);
    const key = `${item.name}|${optionsKey}|${item.status}`;

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.count += 1;
      group.item_ids.push(item.item_id);
      // Keep earliest created_at
      if (item.created_at < group.created_at) {
        group.created_at = item.created_at;
      }
    } else {
      groups.set(key, {
        name: item.name,
        options: item.options || [],
        price: item.price,
        status: item.status,
        count: 1,
        item_ids: [item.item_id],
        created_at: item.created_at,
        category_name: item.category_name,
      });
    }
  }

  // Sort by created_at (earliest first)
  return Array.from(groups.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// Helper to group items by status
export function groupItemsByStatus(items: StoredOrderItem[]): Record<string, StoredOrderItem[]> {
  return items.reduce((acc, item) => {
    const status = item.status || 'pending';
    if (!acc[status]) acc[status] = [];
    acc[status].push(item);
    return acc;
  }, {} as Record<string, StoredOrderItem[]>);
}

// Calculate total excluding rejected items
export function calculateOrderTotal(items: StoredOrderItem[]): number {
  return items
    .filter(item => item.status !== 'rejected')
    .reduce((sum, item) => {
      const optionsTotal = item.options?.reduce((optSum, opt) => optSum + opt.price, 0) || 0;
      return sum + item.price + optionsTotal;
    }, 0);
}

// Group items into rounds based on created_at timestamp
// Items placed at the same time (within a minute threshold) are grouped together
// Special request notes are extracted from items (all items in same round share the same note)
export function groupItemsIntoRounds(items: StoredOrderItem[], _specialNotes?: string | null): OrderRound[] {
  if (!items || items.length === 0) return [];

  // Sort items by created_at
  const sortedItems = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const rounds: OrderRound[] = [];
  let currentRound: StoredOrderItem[] = [];
  let currentTimestamp: string | null = null;
  const MINUTE_THRESHOLD = 60 * 1000; // 1 minute threshold to group items

  for (const item of sortedItems) {
    const itemTime = new Date(item.created_at).getTime();

    if (currentTimestamp === null) {
      currentTimestamp = item.created_at;
      currentRound = [item];
    } else {
      const lastTime = new Date(currentTimestamp).getTime();
      if (itemTime - lastTime <= MINUTE_THRESHOLD) {
        // Same round
        currentRound.push(item);
      } else {
        // New round - save current and start new
        // Extract special request from any item in this round (they all share the same note)
        const roundSpecialRequest = currentRound.find(i => i.special_request)?.special_request || null;
        rounds.push({
          roundNumber: rounds.length + 1,
          timestamp: currentTimestamp,
          items: currentRound,
          specialRequest: roundSpecialRequest,
        });
        currentTimestamp = item.created_at;
        currentRound = [item];
      }
    }
  }

  // Push last round - extract special request from items
  if (currentRound.length > 0 && currentTimestamp) {
    const roundSpecialRequest = currentRound.find(i => i.special_request)?.special_request || null;
    rounds.push({
      roundNumber: rounds.length + 1,
      timestamp: currentTimestamp,
      items: currentRound,
      specialRequest: roundSpecialRequest,
    });
  }

  return rounds;
}

// Group items within a round for display (by name + options + status)
export function groupRoundItems(items: StoredOrderItem[]): GroupedOrderItem[] {
  return groupOrderItems(items);
}

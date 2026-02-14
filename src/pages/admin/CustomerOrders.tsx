import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  CheckCircle, 
  UtensilsCrossed,
  Package,
  Store,
  DollarSign
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StoredOrderItem, groupItemsIntoRounds } from '@/types/order';
import OrderCard from '@/components/admin/orders/OrderCard';
import { 
  CustomerOrdersFilters, 
  OrderFilters, 
  defaultFilters,
  SortDirection
} from '@/components/admin/orders/CustomerOrdersFilters';
import { startOfDay, subMinutes, isAfter, isBefore, isEqual } from 'date-fns';

interface CustomerOrder {
  id: string;
  shop_id: string;
  device_id: string;
  status: string;
  total_usd: number;
  customer_notes: string | null;
  items: StoredOrderItem[];
  order_type: string;
  table_id: string | null;
  table_number?: string;
  created_at: string;
  updated_at: string;
}

// Calculate total excluding rejected items
function calculateOrderTotal(items: StoredOrderItem[]): number {
  return items
    .filter(item => item.status !== 'rejected')
    .reduce((sum, item) => {
      const optionsTotal = item.options?.reduce((optSum, opt) => optSum + opt.price, 0) || 0;
      return sum + item.price + optionsTotal;
    }, 0);
}

// Get the number of rounds in an order
function getOrderRoundsCount(items: StoredOrderItem[]): number {
  const rounds = groupItemsIntoRounds(items);
  return rounds.length;
}

// Check if order contains items with specific status
function orderContainsStatus(items: StoredOrderItem[], status: string): boolean {
  return items.some(item => item.status === status);
}

const FILTER_STORAGE_KEY = 'customerOrdersFilters';

function loadPersistedFilters(): {
  filters: OrderFilters;
  activeTab: 'all' | 'dine_in' | 'takeaway';
  activeQuickFilter: '' | 'pending' | 'preparing' | 'ready';
  sortDirection: SortDirection;
} {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.filters?.customDateFrom) parsed.filters.customDateFrom = new Date(parsed.filters.customDateFrom);
      if (parsed.filters?.customDateTo) parsed.filters.customDateTo = new Date(parsed.filters.customDateTo);
      parsed.activeQuickFilter = parsed.activeQuickFilter || '';
      return parsed;
    }
  } catch {}
  return { filters: defaultFilters, activeTab: 'all', activeQuickFilter: '', sortDirection: 'desc' };
}

const CustomerOrders = () => {
  const navigate = useNavigate();
  const { restaurant } = useUserProfile();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const persisted = useMemo(() => loadPersistedFilters(), []);
  const [activeTab, setActiveTab] = useState<'all' | 'dine_in' | 'takeaway'>(persisted.activeTab);
  const [filters, setFilters] = useState<OrderFilters>(persisted.filters);
  const [activeQuickFilter, setActiveQuickFilter] = useState<'' | 'pending' | 'preparing' | 'ready'>(persisted.activeQuickFilter || '');
  const [sortDirection, setSortDirection] = useState<SortDirection>(persisted.sortDirection);

  // Persist filter state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ filters, activeTab, activeQuickFilter, sortDirection }));
  }, [filters, activeTab, activeQuickFilter, sortDirection]);

  const fetchOrders = async () => {
    if (!restaurant?.id) return;

    setLoading(true);
    try {
      // Fetch orders from tb_order_temporary (active placed orders)
      const { data: tempOrders, error: tempError } = await supabase
        .from('tb_order_temporary')
        .select('*')
        .eq('shop_id', restaurant.id)
        .eq('status', 'placed')
        .order('updated_at', { ascending: false });

      if (tempError) throw tempError;

      // Fetch table numbers for dine-in orders
      const tableIds = (tempOrders || [])
        .filter(o => o.table_id)
        .map(o => o.table_id as string);

      let tableMap: Record<string, string> = {};
      if (tableIds.length > 0) {
        const { data: tables } = await supabase
          .from('tables')
          .select('id, table_number')
          .in('id', tableIds);

        tableMap = (tables || []).reduce((acc, t) => {
          acc[t.id] = t.table_number;
          return acc;
        }, {} as Record<string, string>);
      }

      // Map orders with proper types
      const mappedOrders: CustomerOrder[] = (tempOrders || []).map(order => {
        // Parse items from JSON - handle both cart format and expanded format
        const items: StoredOrderItem[] = Array.isArray(order.items)
          ? (order.items as unknown[]).filter((item: any) => item.item_id).map((item: any) => ({
              item_id: item.item_id || '',
              menu_item_id: item.menu_item_id || '',
              name: item.name || '',
              price: item.price || 0,
              options: item.options || [],
              status: item.status || 'pending',
              created_at: item.created_at || order.created_at,
              special_request: item.special_request || null,
            }))
          : [];

        return {
          id: order.id,
          shop_id: order.shop_id,
          device_id: order.device_id,
          status: order.status,
          total_usd: order.total_usd || 0,
          customer_notes: order.customer_notes,
          items,
          order_type: order.order_type || 'takeaway',
          table_id: order.table_id || null,
          table_number: order.table_id ? tableMap[order.table_id] : undefined,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      });

      setOrders(mappedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Real-time subscription to tb_order_temporary
    if (!restaurant?.id) return;

    const channel = supabase
      .channel('customer-orders-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tb_order_temporary',
          filter: `shop_id=eq.${restaurant.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  // Apply all filters
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Order Type filter (from tabs)
    if (activeTab !== 'all') {
      result = result.filter(order => order.order_type === activeTab);
    }

    // Time filter
    const now = new Date();
    if (filters.timePreset === 'last15min') {
      const threshold = subMinutes(now, 15);
      result = result.filter(order => isAfter(new Date(order.created_at), threshold));
    } else if (filters.timePreset === 'last30min') {
      const threshold = subMinutes(now, 30);
      result = result.filter(order => isAfter(new Date(order.created_at), threshold));
    } else if (filters.timePreset === 'today') {
      const todayStart = startOfDay(now);
      result = result.filter(order => isAfter(new Date(order.created_at), todayStart) || isEqual(new Date(order.created_at), todayStart));
    } else if (filters.timePreset === 'custom' && filters.customDateFrom && filters.customDateTo) {
      const fromDate = startOfDay(filters.customDateFrom);
      const toDate = new Date(filters.customDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(order => {
        const orderDate = new Date(order.created_at);
        return (isAfter(orderDate, fromDate) || isEqual(orderDate, fromDate)) && 
               (isBefore(orderDate, toDate) || isEqual(orderDate, toDate));
      });
    }

    // Amount filter (using calculated total excluding rejected items)
    if (filters.amountOperator !== 'none') {
      result = result.filter(order => {
        const total = calculateOrderTotal(order.items);
        if (filters.amountOperator === 'gt' && filters.amountValue !== undefined) {
          return total > filters.amountValue;
        }
        if (filters.amountOperator === 'lt' && filters.amountValue !== undefined) {
          return total < filters.amountValue;
        }
        if (filters.amountOperator === 'between' && filters.amountMin !== undefined && filters.amountMax !== undefined) {
          return total >= filters.amountMin && total <= filters.amountMax;
        }
        return true;
      });
    }

    // Item count filter
    if (filters.itemCountOperator !== 'none' && filters.itemCountValue !== undefined) {
      result = result.filter(order => {
        const count = order.items.length;
        if (filters.itemCountOperator === 'gte') {
          return count >= filters.itemCountValue!;
        }
        if (filters.itemCountOperator === 'lte') {
          return count <= filters.itemCountValue!;
        }
        return true;
      });
    }

    // Rounds filter
    if (filters.roundsFilter !== 'all') {
      result = result.filter(order => {
        const roundsCount = getOrderRoundsCount(order.items);
        if (filters.roundsFilter === 'single') {
          return roundsCount === 1;
        }
        if (filters.roundsFilter === 'multiple') {
          return roundsCount >= 2;
        }
        return true;
      });
    }

    // Item status contains filter
    const statusFiltersActive = Object.values(filters.statusContains).some(v => v);
    if (statusFiltersActive) {
      result = result.filter(order => {
        // Order must contain at least one item with any of the selected statuses
        if (filters.statusContains.pending && orderContainsStatus(order.items, 'pending')) return true;
        if (filters.statusContains.preparing && orderContainsStatus(order.items, 'preparing')) return true;
        if (filters.statusContains.ready && orderContainsStatus(order.items, 'ready')) return true;
        if (filters.statusContains.rejected && orderContainsStatus(order.items, 'rejected')) return true;
        return false;
      });
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [orders, activeTab, filters, sortDirection]);

  // Handle quick filter clicks
  const handleQuickFilter = (type: 'pending' | 'preparing' | 'ready') => {
    if (activeQuickFilter === type) {
      // Toggle off
      setActiveQuickFilter('');
      setFilters(defaultFilters);
    } else {
      setActiveQuickFilter(type);
      const newFilters = {
        ...defaultFilters,
        statusContains: { ...defaultFilters.statusContains },
      };
      if (type === 'pending') {
        newFilters.statusContains.pending = true;
      } else if (type === 'preparing') {
        newFilters.statusContains.preparing = true;
      } else if (type === 'ready') {
        newFilters.statusContains.ready = true;
      }
      setFilters(newFilters);
    }
  };

  // Handle filter changes - clear quick filter when manually changing filters
  const handleFiltersChange = (newFilters: OrderFilters) => {
    setFilters(newFilters);
    setActiveQuickFilter('');
  };

  // Group dine-in orders by table
  const groupedByTable = filteredOrders
    .filter(o => o.order_type === 'dine_in')
    .reduce((acc, order) => {
      const key = order.table_number || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {} as Record<string, CustomerOrder[]>);

  // Get takeaway orders
  const takeawayOrders = filteredOrders.filter(o => o.order_type === 'takeaway');

  // Stats (from all orders, not filtered)
  const stats = {
    total: orders.length,
    dineIn: orders.filter(o => o.order_type === 'dine_in').length,
    takeaway: orders.filter(o => o.order_type === 'takeaway').length,
    totalRevenue: orders.reduce((sum, o) => sum + calculateOrderTotal(o.items), 0),
  };

  const handleOrderClick = (orderId: string) => {
    navigate(`/admin/customer-orders/${orderId}`);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dine-in</p>
                <p className="text-2xl font-bold">{stats.dineIn}</p>
              </div>
              <UtensilsCrossed className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Takeaway</p>
                <p className="text-2xl font-bold">{stats.takeaway}</p>
              </div>
              <Store className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Filters in one row */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              All ({filteredOrders.length})
            </TabsTrigger>
            <TabsTrigger value="dine_in" className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Dine-in ({filteredOrders.filter(o => o.order_type === 'dine_in').length})
            </TabsTrigger>
            <TabsTrigger value="takeaway" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Takeaway ({filteredOrders.filter(o => o.order_type === 'takeaway').length})
            </TabsTrigger>
          </TabsList>

          <CustomerOrdersFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onQuickFilter={handleQuickFilter}
            activeQuickFilter={activeQuickFilter}
            sortDirection={sortDirection}
            onSortChange={setSortDirection}
          />
        </div>

        {/* Filtered Results Count */}
        {filteredOrders.length !== orders.length && (
          <p className="text-sm text-muted-foreground mt-2">
            Showing {filteredOrders.length} of {orders.length} orders
          </p>
        )}

        <TabsContent value="all" className="mt-6">
          {filteredOrders.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onClick={() => handleOrderClick(order.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dine_in" className="mt-6">
          {filteredOrders.filter(o => o.order_type === 'dine_in').length === 0 ? (
            <EmptyState message="No dine-in orders match filters" />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByTable).map(([tableNumber, tableOrders]) => (
                <div key={tableNumber}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5" />
                    Table {tableNumber}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tableOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order}
                        onClick={() => handleOrderClick(order.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="takeaway" className="mt-6">
          {takeawayOrders.length === 0 ? (
            <EmptyState message="No takeaway orders match filters" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {takeawayOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order}
                  onClick={() => handleOrderClick(order.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ message = "No active orders" }: { message?: string }) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium">{message}</p>
      <p className="text-muted-foreground">Orders will appear here when customers scan and order</p>
    </CardContent>
  </Card>
);

export default CustomerOrders;

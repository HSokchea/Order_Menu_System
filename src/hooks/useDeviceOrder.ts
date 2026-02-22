import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeviceId } from './useDeviceId';

export interface OrderItem {
  id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price_usd: number;
  options?: Array<{
    groupName: string;
    label: string;
    price: number;
  }>;
  notes?: string;
}

export interface TemporaryOrder {
  id: string;
  shop_id: string;
  device_id: string;
  status: string;
  total_usd: number;
  customer_notes: string | null;
  items: OrderItem[];
  order_type: 'dine_in' | 'takeaway';
  table_id: string | null;
  created_at: string;
  updated_at: string;
}

interface UseDeviceOrderResult {
  order: TemporaryOrder | null;
  isLoading: boolean;
  isExistingOrder: boolean;
  error: string | null;
  deviceId: string | null;
  addItem: (item: OrderItem) => Promise<void>;
  removeItem: (menuItemId: string) => Promise<void>;
  updateItemQuantity: (menuItemId: string, quantity: number) => Promise<void>;
  clearOrder: () => Promise<void>;
  updateNotes: (notes: string) => Promise<void>;
  placeOrder: () => Promise<{ success: boolean; historyId?: string; orderId?: string; error?: string }>;
  refreshOrder: () => Promise<void>;
}

/**
 * Hook to manage device-based temporary orders
 * Handles order creation, updates, and payment completion
 * @param shopId - The shop ID
 * @param tableId - Optional table ID for dine-in orders (from URL query param)
 */
export const useDeviceOrder = (shopId?: string, tableId?: string | null): UseDeviceOrderResult => {
  const { deviceId, isLoaded: deviceIdLoaded } = useDeviceId();
  const [order, setOrder] = useState<TemporaryOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExistingOrder, setIsExistingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch or create order for this device/shop/today
  const fetchOrCreateOrder = useCallback(async () => {
    if (!shopId || !deviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build RPC params - include table_id if provided
      const rpcParams: { p_shop_id: string; p_device_id: string; p_table_id?: string } = {
        p_shop_id: shopId,
        p_device_id: deviceId,
      };
      
      if (tableId) {
        rpcParams.p_table_id = tableId;
      }

      const { data, error: rpcError } = await supabase.rpc('get_or_create_device_order', rpcParams);

      if (rpcError) {
        console.error('Error fetching device order:', rpcError);
        setError(rpcError.message);
        return;
      }

      if (data) {
        const response = data as { exists: boolean; order: any };
        setIsExistingOrder(response.exists);
        
        // Parse items from JSONB
        const orderData = response.order;
        const items = Array.isArray(orderData.items) ? orderData.items : [];
        
        setOrder({
          ...orderData,
          items,
          order_type: orderData.order_type || 'takeaway',
          table_id: orderData.table_id || null,
        });
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'Failed to load order');
    } finally {
      setIsLoading(false);
    }
  }, [shopId, deviceId, tableId]);

  // Load order when device ID is ready
  useEffect(() => {
    if (deviceIdLoaded && shopId && deviceId) {
      fetchOrCreateOrder();
    }
  }, [deviceIdLoaded, shopId, deviceId, fetchOrCreateOrder]);

  // Calculate total from items
  const calculateTotal = useCallback((items: OrderItem[]): number => {
    return items.reduce((sum, item) => {
      const optionsTotal = item.options?.reduce((optSum, opt) => optSum + opt.price, 0) || 0;
      return sum + (item.price_usd + optionsTotal) * item.quantity;
    }, 0);
  }, []);

  // Direct update to tb_order_temporary (for local-only operations like remove/clear)
  // This sets items directly without append behavior
  const setOrderItems = useCallback(async (items: OrderItem[], notes?: string) => {
    if (!order || !deviceId) return;

    const total = calculateTotal(items);
    
    // Direct table update (not using the append RPC)
    const { error: updateError } = await supabase
      .from('tb_order_temporary')
      .update({
        items: items as any,
        total_usd: total,
        customer_notes: notes ?? order.customer_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('device_id', deviceId);

    if (updateError) {
      console.error('Error setting order items:', updateError);
      throw new Error(updateError.message);
    }

    // Update local state
    setOrder(prev => prev ? {
      ...prev,
      items,
      total_usd: total,
      customer_notes: notes ?? prev.customer_notes,
    } : null);
  }, [order, deviceId, calculateTotal]);

  // Add item to order (appends to existing items via RPC)
  const addItem = useCallback(async (item: OrderItem) => {
    if (!order || !deviceId) return;

    // Send only the new item - RPC will append it
    const newItems = [item];
    const newItemTotal = (item.price_usd + (item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0)) * item.quantity;
    
    const { data, error: updateError } = await supabase.rpc('update_device_order', {
      p_order_id: order.id,
      p_device_id: deviceId,
      p_items: newItems as any,
      p_total_usd: newItemTotal, // This is ignored by RPC, it recalculates
      p_customer_notes: order.customer_notes,
    });

    if (updateError) {
      console.error('Error adding item:', updateError);
      throw new Error(updateError.message);
    }

    const response = data as { success: boolean; order?: any; error?: string };
    if (!response.success) {
      throw new Error(response.error || 'Failed to add item');
    }

    // Update local state from response (which has merged items)
    if (response.order) {
      const mergedItems = Array.isArray(response.order.items) ? response.order.items : [];
      setOrder(prev => prev ? {
        ...prev,
        items: mergedItems,
        total_usd: response.order.total_usd,
      } : null);
    }
  }, [order, deviceId]);

  // Remove item from order
  const removeItem = useCallback(async (menuItemId: string) => {
    if (!order) return;

    const updatedItems = order.items.filter(i => i.menu_item_id !== menuItemId);
    await setOrderItems(updatedItems);
  }, [order, setOrderItems]);

  // Update item quantity
  const updateItemQuantity = useCallback(async (menuItemId: string, quantity: number) => {
    if (!order) return;

    if (quantity <= 0) {
      await removeItem(menuItemId);
      return;
    }

    const updatedItems = order.items.map(i => 
      i.menu_item_id === menuItemId ? { ...i, quantity } : i
    );
    await setOrderItems(updatedItems);
  }, [order, setOrderItems, removeItem]);

  // Clear all items
  const clearOrder = useCallback(async () => {
    if (!order) return;
    await setOrderItems([]);
  }, [order, setOrderItems]);

  // Update customer notes
  const updateNotes = useCallback(async (notes: string) => {
    if (!order) return;
    await setOrderItems(order.items, notes);
  }, [order, setOrderItems]);

  // Refresh order from database
  const refreshOrder = useCallback(async () => {
    await fetchOrCreateOrder();
  }, [fetchOrCreateOrder]);

  // Place order (with backend IP validation via edge function)
  const placeOrder = useCallback(async () => {
    if (!order || !deviceId) {
      return { success: false, error: 'No active order' };
    }

    if (!order.items || order.items.length === 0) {
      return { success: false, error: 'Cannot place an empty order' };
    }

    try {
      // Use the secure edge function that validates IP before placing
      const { data, error: invokeError } = await supabase.functions.invoke('place-order-secure', {
        body: {
          order_id: order.id,
          device_id: deviceId,
          shop_id: order.shop_id,
        },
      });

      if (invokeError) {
        return { success: false, error: invokeError.message };
      }

      const response = data as { success: boolean; order_id?: string; error?: string; reason?: string };

      if (response.success) {
        await refreshOrder();
      }

      return {
        success: response.success,
        orderId: response.order_id,
        error: response.error,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [order, deviceId, refreshOrder]);

  return {
    order,
    isLoading: isLoading || !deviceIdLoaded,
    isExistingOrder,
    error,
    deviceId,
    addItem,
    removeItem,
    updateItemQuantity,
    clearOrder,
    updateNotes,
    placeOrder,
    refreshOrder,
  };
};

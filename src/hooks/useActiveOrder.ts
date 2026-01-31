import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeviceId } from './useDeviceId';
import type { ActiveOrder, ShopInfo, StoredOrderItem } from '@/types/order';

interface UseActiveOrderResult {
  order: ActiveOrder | null;
  shop: ShopInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and track an active order for the current device
 * Returns items with the new single-unit structure
 */
export const useActiveOrder = (shopId?: string): UseActiveOrderResult => {
  const { deviceId, isLoaded: deviceIdLoaded } = useDeviceId();
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveOrder = useCallback(async () => {
    if (!shopId || !deviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_device_active_order', {
        p_shop_id: shopId,
        p_device_id: deviceId,
      });

      if (rpcError) {
        console.error('Error fetching active order:', rpcError);
        setError(rpcError.message);
        setOrder(null);
        return;
      }

      const response = data as { success: boolean; order?: any; shop?: any; error?: string };

      if (response.success && response.order) {
        // Parse items - now they're individual units with status
        const items: StoredOrderItem[] = Array.isArray(response.order.items) 
          ? response.order.items.map((item: any) => ({
              item_id: item.item_id,
              menu_item_id: item.menu_item_id,
              name: item.name,
              price: item.price || 0,
              options: item.options || [],
              status: item.status || 'pending',
              created_at: item.created_at,
            }))
          : [];

        setOrder({
          id: response.order.id,
          shop_id: response.order.shop_id,
          device_id: response.order.device_id,
          status: response.order.status,
          total_usd: response.order.total_usd || 0,
          customer_notes: response.order.customer_notes,
          items,
          order_type: response.order.order_type || 'takeaway',
          table_id: response.order.table_id || null,
          table_number: response.order.table_number || null,
          created_at: response.order.created_at,
          updated_at: response.order.updated_at,
          paid_at: response.order.paid_at || null,
        });
        setShop(response.shop || null);
      } else {
        setOrder(null);
        setError(response.error || null);
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'Failed to load order');
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, deviceId]);

  // Initial fetch
  useEffect(() => {
    if (deviceIdLoaded && shopId && deviceId) {
      fetchActiveOrder();
    } else if (deviceIdLoaded && (!shopId || !deviceId)) {
      setIsLoading(false);
    }
  }, [deviceIdLoaded, shopId, deviceId, fetchActiveOrder]);

  // Set up real-time subscription for order updates from tb_order_temporary
  useEffect(() => {
    if (!order?.id) return;

    const channel = supabase
      .channel(`active-order-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tb_order_temporary',
          filter: `id=eq.${order.id}`,
        },
        () => {
          fetchActiveOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id, fetchActiveOrder]);

  return {
    order,
    shop,
    isLoading: isLoading || !deviceIdLoaded,
    error,
    refetch: fetchActiveOrder,
  };
};

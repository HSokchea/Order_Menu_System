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

  // Fetch shop info once (cached in state)
  const fetchShopInfo = useCallback(async () => {
    if (!shopId || shop) return;
    try {
      const { data } = await supabase.rpc('get_public_shop', { p_shop_id: shopId });
      if (data && data.length > 0) {
        // Get full restaurant info for receipt fields via get_device_active_order fallback
        const { data: rpcData } = await supabase.rpc('get_device_active_order', {
          p_shop_id: shopId,
          p_device_id: deviceId || '',
        });
        const response = rpcData as { success: boolean; shop?: any } | null;
        if (response?.shop) {
          setShop({
            name: response.shop.name,
            currency: response.shop.currency || 'USD',
            logo_url: response.shop.logo_url || null,
            address: response.shop.address || null,
            city: response.shop.city || null,
            country: response.shop.country || null,
            phone: response.shop.phone || null,
            vat_tin: response.shop.vat_tin || null,
            default_tax_percentage: Number(response.shop.default_tax_percentage) || 0,
            service_charge_percentage: Number(response.shop.service_charge_percentage) || 0,
            exchange_rate_usd_to_khr: Number(response.shop.exchange_rate_usd_to_khr) || 4100,
            receipt_header_text: response.shop.receipt_header_text || null,
            receipt_footer_text: response.shop.receipt_footer_text || null,
          });
        } else {
          setShop({
            name: data[0].name || '',
            currency: data[0].currency || 'USD',
            logo_url: data[0].logo_url || null,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching shop info:', err);
    }
  }, [shopId, deviceId, shop]);

  // Fetch order directly from tb_order_temporary table
  const fetchActiveOrder = useCallback(async () => {
    if (!shopId || !deviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: orderData, error: queryError } = await supabase
        .from('tb_order_temporary')
        .select('*')
        .eq('shop_id', shopId)
        .eq('device_id', deviceId)
        .eq('order_date', today)
        .in('status', ['pending', 'placed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (queryError) {
        console.error('Error fetching active order:', queryError);
        setError(queryError.message);
        setOrder(null);
        return;
      }

      if (!orderData) {
        setOrder(null);
        setError(null);
        return;
      }

      // Parse items
      const rawItems = Array.isArray(orderData.items) ? orderData.items : [];
      const items: StoredOrderItem[] = rawItems.map((item: any) => ({
        item_id: item.item_id,
        menu_item_id: item.menu_item_id,
        name: item.name,
        price: item.price || 0,
        options: item.options || [],
        status: item.status || 'pending',
        created_at: item.created_at,
        special_request: item.special_request || null,
      }));

      // Get table_number if table_id exists
      let tableNumber: string | null = null;
      if (orderData.table_id) {
        const { data: tableData } = await supabase.rpc('get_public_table_by_id', {
          p_table_id: orderData.table_id,
        });
        if (tableData && tableData.length > 0) {
          tableNumber = tableData[0].table_number;
        }
      }

      setOrder({
        id: orderData.id,
        shop_id: orderData.shop_id,
        device_id: orderData.device_id,
        status: orderData.status as ActiveOrder['status'],
        total_usd: orderData.total_usd || 0,
        customer_notes: orderData.customer_notes,
        items,
        order_type: (orderData.order_type as 'dine_in' | 'takeaway') || 'takeaway',
        table_id: orderData.table_id || null,
        table_number: tableNumber,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at,
        paid_at: null,
      });

      // Fetch shop info if not loaded yet
      fetchShopInfo();
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'Failed to load order');
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, deviceId, fetchShopInfo]);

  // Initial fetch
  useEffect(() => {
    if (deviceIdLoaded && shopId && deviceId) {
      fetchActiveOrder();
    } else if (deviceIdLoaded && (!shopId || !deviceId)) {
      setIsLoading(false);
    }
  }, [deviceIdLoaded, shopId, deviceId, fetchActiveOrder]);

  // Set up real-time subscription for order updates (no polling)
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

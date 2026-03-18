import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
 * Fetches order data directly from tb_order_temporary table
 */
const fetchOrderData = async (
  shopId: string,
  deviceId: string
): Promise<{ order: ActiveOrder | null }> => {
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

  if (queryError) throw new Error(queryError.message);
  if (!orderData) return { order: null };

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

  return {
    order: {
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
    },
  };
};

/**
 * Fetches shop info
 */
const fetchShopData = async (shopId: string, deviceId: string): Promise<ShopInfo | null> => {
  // Try get_device_active_order RPC for full restaurant info
  const { data: rpcData } = await supabase.rpc('get_device_active_order', {
    p_shop_id: shopId,
    p_device_id: deviceId || '',
  });
  const response = rpcData as { success: boolean; shop?: any } | null;
  if (response?.shop) {
    return {
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
    };
  }

  // Fallback to get_public_shop
  const { data } = await supabase.rpc('get_public_shop', { p_shop_id: shopId });
  if (data && data.length > 0) {
    return {
      name: data[0].name || '',
      currency: data[0].currency || 'USD',
      logo_url: data[0].logo_url || null,
    };
  }
  return null;
};

/**
 * Hook to fetch and track an active order for the current device.
 * Uses React Query for caching + Supabase realtime for push updates.
 * - Skeleton loads only once on initial fetch
 * - Realtime updates merge in-place without triggering skeleton
 */
export const useActiveOrder = (shopId?: string): UseActiveOrderResult => {
  const { deviceId, isLoaded: deviceIdLoaded } = useDeviceId();
  const queryClient = useQueryClient();
  const lastUpdatedAtRef = useRef<string | null>(null);

  const enabled = !!shopId && !!deviceId && deviceIdLoaded;

  // Main order query - React Query handles caching, dedup, loading state
  const {
    data: orderResult,
    isLoading: isOrderLoading,
    error: orderError,
  } = useQuery({
    queryKey: ['activeOrder', shopId, deviceId],
    queryFn: () => fetchOrderData(shopId!, deviceId!),
    enabled,
    staleTime: 30 * 1000, // 30s - realtime handles freshness
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false, // realtime handles this
  });

  // Shop info query - fetched once and cached long
  const { data: shopData } = useQuery({
    queryKey: ['shopInfo', shopId, deviceId],
    queryFn: () => fetchShopData(shopId!, deviceId!),
    enabled: enabled && !!orderResult?.order,
    staleTime: 5 * 60 * 1000, // 5 min cache
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const orderId = orderResult?.order?.id;

  // Supabase realtime subscription - invalidates React Query cache on changes
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`active-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tb_order_temporary',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // Deduplicate by updated_at to avoid double updates
          const newUpdatedAt = (payload.new as any)?.updated_at;
          if (newUpdatedAt && newUpdatedAt === lastUpdatedAtRef.current) {
            return; // Skip duplicate event
          }
          lastUpdatedAtRef.current = newUpdatedAt || null;

          if (payload.eventType === 'DELETE') {
            // Order was deleted (e.g., paid) - clear cache
            queryClient.setQueryData(['activeOrder', shopId, deviceId], { order: null });
            return;
          }

          // For UPDATE events, apply optimistic update from payload directly
          if (payload.eventType === 'UPDATE' && payload.new) {
            const newData = payload.new as any;
            const rawItems = Array.isArray(newData.items) ? newData.items : [];
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

            queryClient.setQueryData(
              ['activeOrder', shopId, deviceId],
              (old: { order: ActiveOrder | null } | undefined) => {
                if (!old?.order) return old;
                return {
                  order: {
                    ...old.order,
                    status: newData.status as ActiveOrder['status'],
                    total_usd: newData.total_usd || 0,
                    customer_notes: newData.customer_notes,
                    items,
                    updated_at: newData.updated_at,
                  },
                };
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, shopId, deviceId, queryClient]);

  // Manual refetch for pull-to-refresh
  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['activeOrder', shopId, deviceId] });
  }, [queryClient, shopId, deviceId]);

  return {
    order: orderResult?.order ?? null,
    shop: shopData ?? null,
    isLoading: !deviceIdLoaded || (enabled && isOrderLoading),
    error: orderError?.message ?? null,
    refetch,
  };
};

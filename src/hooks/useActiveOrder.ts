import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeviceId } from './useDeviceId';

export interface ActiveOrderItem {
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

export interface ActiveOrder {
  id: string;
  shop_id: string;
  device_id: string;
  status: 'placed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  total_usd: number;
  customer_notes: string | null;
  items: ActiveOrderItem[];
  order_type: 'dine_in' | 'takeaway';
  table_id: string | null;
  table_number: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export interface ShopInfo {
  name: string;
  currency: string;
  logo_url: string | null;
}

interface UseActiveOrderResult {
  order: ActiveOrder | null;
  shop: ShopInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and track an active order for the current device
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
        const items = Array.isArray(response.order.items) ? response.order.items : [];
        setOrder({
          ...response.order,
          items,
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

  // Auto-refresh every 30 seconds for status updates
  useEffect(() => {
    if (!order) return;

    const interval = setInterval(() => {
      fetchActiveOrder();
    }, 30000);

    return () => clearInterval(interval);
  }, [order, fetchActiveOrder]);

  return {
    order,
    shop,
    isLoading: isLoading || !deviceIdLoaded,
    error,
    refetch: fetchActiveOrder,
  };
};

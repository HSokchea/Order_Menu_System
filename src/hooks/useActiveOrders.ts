import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveOrder {
  id: string;
  table_number: string;
  total_usd: number;
  status: string;
  created_at: string;
  restaurant_name: string;
}

export const useActiveOrders = (tableId: string) => {
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveOrders = useCallback(async () => {
    if (!tableId) {
      console.log('No tableId provided to useActiveOrders');
      setLoading(false);
      return;
    }

    try {
      // Get all order tokens from localStorage
      const storedTokens = JSON.parse(localStorage.getItem('order_tokens') || '{}');
      const tokenValues = Object.values(storedTokens) as string[];

      if (tokenValues.length === 0) {
        console.log('No order tokens found in localStorage');
        setActiveOrders([]);
        setLoading(false);
        return;
      }

      console.log('Fetching active orders with tokens:', tokenValues.length);
      
      // Use secure RPC function with token validation
      const { data: orders, error } = await supabase.rpc('get_active_orders_by_tokens', {
        p_order_tokens: tokenValues
      });

      console.log('Orders query result:', { orders, error });

      if (error) {
        console.error('Error fetching active orders:', error);
        setActiveOrders([]);
      } else {
        // Filter orders to only those matching the current table
        const filteredOrders = (orders || []).filter((order: any) => 
          order.table_id === tableId || order.table_number === tableId
        );
        
        const mappedOrders: ActiveOrder[] = filteredOrders.map((order: any) => ({
          id: order.id,
          table_number: order.table_number,
          total_usd: Number(order.total_usd || 0),
          status: order.status || 'new',
          created_at: order.created_at,
          restaurant_name: order.restaurant_name || 'Restaurant'
        }));
        
        console.log('Mapped orders:', mappedOrders);
        setActiveOrders(mappedOrders);
      }
    } catch (error) {
      console.error('Unexpected error fetching orders:', error);
      setActiveOrders([]);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchActiveOrders();
  }, [fetchActiveOrders]);

  useEffect(() => {
    fetchActiveOrders();

    // Set up real-time subscription for order status updates
    // Note: This will only show updates for orders the user has tokens for
    const channel = supabase
      .channel('active-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Realtime order update received:', payload);
          // Refetch orders when any order changes
          fetchActiveOrders();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, fetchActiveOrders]);

  return { activeOrders, loading, refetch };
};
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchActiveOrders = async () => {
      if (!tableId) {
        console.log('No tableId provided to useActiveOrders');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching active orders for tableId:', tableId);
        
        // Try to match by table_number first (string comparison), then by table_id (UUID)
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            table_number,
            table_id,
            total_usd,
            status,
            created_at,
            restaurants:restaurant_id (name)
          `)
          .or(`table_number.eq.${tableId},table_id.eq.${tableId}`)
          .neq('status', 'completed')
          .order('created_at', { ascending: false });

        console.log('Orders query result:', { orders, error, tableId, queryUsed: `table_number.eq.${tableId},table_id.eq.${tableId}` });

        if (error) {
          console.error('Error fetching active orders:', error);
          setActiveOrders([]);
        } else {
          const mappedOrders: ActiveOrder[] = (orders || []).map(order => ({
            id: order.id,
            table_number: order.table_number,
            total_usd: Number(order.total_usd || 0),
            status: order.status || 'new',
            created_at: order.created_at,
            restaurant_name: (order.restaurants as any)?.name || 'Restaurant'
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
    };

    fetchActiveOrders();

    // Set up real-time subscription for order status updates
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
          // Refetch orders when any order changes
          fetchActiveOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  return { activeOrders, loading };
};
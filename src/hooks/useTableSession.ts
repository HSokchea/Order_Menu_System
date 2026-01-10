import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SessionOrder {
  id: string;
  total_usd: number;
  status: string;
  created_at: string;
  customer_notes: string | null;
  items: Array<{
    id: string;
    quantity: number;
    price_usd: number;
    notes: string | null;
    menu_item_name: string;
  }>;
}

interface TableSession {
  session_id: string;
  table_id: string;
  table_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_phone: string | null;
  restaurant_address: string | null;
  restaurant_city: string | null;
  restaurant_country: string | null;
  restaurant_logo_url: string | null;
  restaurant_vat_tin: string | null;
  default_tax_percentage: number;
  service_charge_percentage: number;
  exchange_rate_usd_to_khr: number;
  exchange_rate_at_payment: number | null; // Frozen rate at payment time
  receipt_header_text: string | null;
  receipt_footer_text: string | null;
  currency: string;
  status: 'open' | 'paid';
  started_at: string;
  ended_at: string | null;
  total_amount: number;
  order_type: string;
  invoice_number: string | null;
  cashier_name: string | null;
  orders: SessionOrder[];
}

export const useTableSession = (tableId: string | undefined) => {
  const [session, setSession] = useState<TableSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!tableId) {
      setLoading(false);
      return;
    }

    try {
      // First check if there's an open session for this table
      const { data: sessionData, error: sessionError } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .maybeSingle();

      if (sessionError) throw sessionError;

      if (!sessionData) {
        setSession(null);
        setLoading(false);
        return;
      }

      // Get session details using RPC
      const { data: details, error: detailsError } = await supabase
        .rpc('get_session_details', { p_session_id: sessionData.id });

      if (detailsError) throw detailsError;

      if (details && details.length > 0) {
        const sessionRow = details[0];
        const ordersArray = Array.isArray(sessionRow.orders) 
          ? sessionRow.orders 
          : [];
        //here
        setSession({
          session_id: sessionRow.session_id,
          table_id: sessionRow.table_id,
          table_number: sessionRow.table_number,
          restaurant_id: sessionRow.restaurant_id,
          restaurant_name: sessionRow.restaurant_name,
          restaurant_phone: sessionRow.restaurant_phone || null,
          restaurant_address: sessionRow.restaurant_address || null,
          restaurant_city: sessionRow.restaurant_city || null,
          restaurant_country: sessionRow.restaurant_country || null,
          restaurant_logo_url: sessionRow.restaurant_logo_url || null,
          restaurant_vat_tin: sessionRow.restaurant_vat_tin || null,
          default_tax_percentage: Number(sessionRow.default_tax_percentage) || 0,
          service_charge_percentage: Number(sessionRow.service_charge_percentage) || 0,
          exchange_rate_usd_to_khr: Number(sessionRow.exchange_rate_usd_to_khr) || 4100,
          exchange_rate_at_payment: sessionRow.exchange_rate_at_payment ? Number(sessionRow.exchange_rate_at_payment) : null,
          receipt_header_text: sessionRow.receipt_header_text || null,
          receipt_footer_text: sessionRow.receipt_footer_text || null,
          currency: sessionRow.currency || 'USD',
          status: sessionRow.status as 'open' | 'paid',
          started_at: sessionRow.started_at,
          ended_at: sessionRow.ended_at,
          total_amount: Number(sessionRow.total_amount) || 0,
          order_type: sessionRow.order_type || 'dine_in',
          invoice_number: sessionRow.invoice_number || null,
          cashier_name: sessionRow.cashier_name || null,
          orders: ordersArray.map((o: any) => ({
            id: o.id,
            total_usd: Number(o.total_usd) || 0,
            status: o.status,
            created_at: o.created_at,
            customer_notes: o.customer_notes,
            items: Array.isArray(o.items) ? o.items.map((i: any) => ({
              id: i.id,
              quantity: i.quantity,
              price_usd: Number(i.price_usd) || 0,
              notes: i.notes,
              menu_item_name: i.menu_item_name,
            })) : [],
          })),
        });
      } else {
        setSession(null);
      }
    } catch (err: any) {
      console.error('Error fetching session:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetchSession();

    if (!tableId) return;

    // Real-time subscription for session changes
    const channel = supabase
      .channel(`session-${tableId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `table_id=eq.${tableId}`,
        },
        () => {
          fetchSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, fetchSession]);

  const getSessionTotal = useCallback(() => {
    if (!session) return 0;
    return session.orders.reduce((sum, order) => {
      if (order.status !== 'rejected') {
        return sum + order.total_usd;
      }
      return sum;
    }, 0);
  }, [session]);

  return {
    session,
    loading,
    error,
    refetch: fetchSession,
    getSessionTotal,
  };
};

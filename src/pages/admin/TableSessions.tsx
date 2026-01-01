import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, CheckCircle, CreditCard, Eye, Users } from 'lucide-react';
import { format } from 'date-fns';
import { SessionReceipt, ReceiptSession } from '@/components/receipt/SessionReceipt';
import { ReceiptActions } from '@/components/receipt/ReceiptActions';

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
  id: string;
  table_id: string;
  table_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_phone: string | null;
  restaurant_address: string | null;
  restaurant_city: string | null;
  restaurant_country: string | null;
  restaurant_logo_url: string | null;
  default_tax_percentage: number;
  service_charge_percentage: number;
  currency: string;
  status: 'open' | 'paid';
  started_at: string;
  ended_at: string | null;
  total_amount: number;
  orders: SessionOrder[];
}

const TableSessions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [selectedSession, setSelectedSession] = useState<TableSession | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    if (!user) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, phone, address, city, country, logo_url, default_tax_percentage, service_charge_percentage, currency')
      .eq('owner_id', user.id)
      .single();

    if (!restaurant) return;

    let query = supabase
      .from('table_sessions')
      .select(`
        id,
        table_id,
        status,
        started_at,
        ended_at,
        total_amount,
        tables!inner(table_number)
      `)
      .eq('restaurant_id', restaurant.id)
      .order('started_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: sessionsData, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }

    // Fetch orders with items for each session
    const sessionsWithOrders = await Promise.all(
      (sessionsData || []).map(async (session: any) => {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, total_usd, status, created_at, customer_notes')
          .eq('table_session_id', session.id)
          .order('created_at', { ascending: true });

        // Fetch items for each order
        const ordersWithItems = await Promise.all(
          (orders || []).map(async (order) => {
            const { data: items } = await supabase
              .rpc('get_order_items_by_token', { 
                p_order_id: order.id, 
                p_order_token: '' // Admin doesn't need token
              });

            // Fallback: direct query for admin
            let orderItems = items || [];
            if (orderItems.length === 0) {
              const { data: directItems } = await supabase
                .from('order_items')
                .select('id, quantity, price_usd, notes, menu_item_id')
                .eq('order_id', order.id);

              if (directItems && directItems.length > 0) {
                const menuItemIds = directItems.map(i => i.menu_item_id);
                const { data: menuItems } = await supabase
                  .from('menu_items')
                  .select('id, name')
                  .in('id', menuItemIds);

                const menuItemMap = new Map(menuItems?.map(m => [m.id, m.name]) || []);
                orderItems = directItems.map(i => ({
                  id: i.id,
                  quantity: i.quantity,
                  price_usd: Number(i.price_usd),
                  notes: i.notes,
                  menu_item_name: menuItemMap.get(i.menu_item_id) || 'Unknown Item',
                }));
              }
            }

            return {
              ...order,
              items: orderItems,
            };
          })
        );

        return {
          id: session.id,
          table_id: session.table_id,
          table_number: session.tables.table_number,
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          restaurant_phone: restaurant.phone || null,
          restaurant_address: restaurant.address || null,
          restaurant_city: restaurant.city || null,
          restaurant_country: restaurant.country || null,
          restaurant_logo_url: restaurant.logo_url || null,
          default_tax_percentage: Number(restaurant.default_tax_percentage) || 0,
          service_charge_percentage: Number(restaurant.service_charge_percentage) || 0,
          currency: restaurant.currency || 'USD',
          status: session.status,
          started_at: session.started_at,
          ended_at: session.ended_at,
          total_amount: Number(session.total_amount) || 0,
          orders: ordersWithItems,
        };
      })
    );

    setSessions(sessionsWithOrders);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();

    if (!user) return;

    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => fetchSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchSessions())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, statusFilter]);

  const handleCompletePayment = async (sessionId: string) => {
    setProcessingPayment(true);
    
    try {
      const { data, error } = await supabase.rpc('complete_session_payment', {
        p_session_id: sessionId,
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete payment');
      }

      toast({
        title: 'Payment Completed',
        description: `Session closed. Total: $${result.total_amount.toFixed(2)}`,
      });

      setIsModalOpen(false);
      fetchSessions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const getSessionTotal = (session: TableSession) => {
    return session.orders.reduce((sum, order) => {
      if (order.status !== 'rejected') {
        return sum + Number(order.total_usd);
      }
      return sum;
    }, 0);
  };

  const openSessionsCount = sessions.filter(s => s.status === 'open').length;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Table Sessions</h2>
          <p className="text-sm text-muted-foreground">
            {openSessionsCount} active session{openSessionsCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions Table */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-center">No sessions found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const total = getSessionTotal(session);
                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">Table {session.table_number}</TableCell>
                    <TableCell>{format(new Date(session.started_at), 'MMM d, h:mm a')}</TableCell>
                    <TableCell>{session.orders.length}</TableCell>
                    <TableCell className="font-semibold">${total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                        {session.status === 'open' ? (
                          <><Clock className="h-3 w-3 mr-1" /> Open</>
                        ) : (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Paid</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSession(session);
                            setIsModalOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {session.status === 'open' && (
                          <Button
                            size="sm"
                            onClick={() => handleCompletePayment(session.id)}
                            disabled={processingPayment}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Receipt Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt - Table {selectedSession?.table_number}</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              {/* Actions */}
              <ReceiptActions
                receiptRef={receiptRef}
                sessionId={selectedSession.id}
                isPaid={selectedSession.status === 'paid'}
                isProcessing={processingPayment}
                onCompletePayment={() => handleCompletePayment(selectedSession.id)}
              />

              {/* Receipt Preview */}
              <div className="border rounded-lg overflow-hidden">
                <SessionReceipt
                  ref={receiptRef}
                  session={{
                    session_id: selectedSession.id,
                    table_id: selectedSession.table_id,
                    table_number: selectedSession.table_number,
                    restaurant_id: selectedSession.restaurant_id,
                    restaurant_name: selectedSession.restaurant_name,
                    restaurant_phone: selectedSession.restaurant_phone,
                    restaurant_address: selectedSession.restaurant_address,
                    restaurant_city: selectedSession.restaurant_city,
                    restaurant_country: selectedSession.restaurant_country,
                    restaurant_logo_url: selectedSession.restaurant_logo_url,
                    default_tax_percentage: selectedSession.default_tax_percentage,
                    service_charge_percentage: selectedSession.service_charge_percentage,
                    currency: selectedSession.currency,
                    status: selectedSession.status,
                    started_at: selectedSession.started_at,
                    ended_at: selectedSession.ended_at,
                    total_amount: selectedSession.total_amount,
                    orders: selectedSession.orders,
                  }}
                  isPrintMode
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TableSessions;

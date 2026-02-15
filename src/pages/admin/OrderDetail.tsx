import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  ChefHat,
  XCircle,
  DollarSign,
  Printer,
  Pencil,
  ClipboardList,
  FileText,
  RefreshCw,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  StoredOrderItem,
  groupItemsIntoRounds,
  groupRoundItems,
  calculateOrderTotal
} from '@/types/order';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SessionReceipt, ReceiptSession } from '@/components/receipt/SessionReceipt';
import { ReceiptActions } from '@/components/receipt/ReceiptActions';

interface OrderData {
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

const OrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { restaurant } = useUserProfile();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receiptSession, setReceiptSession] = useState<ReceiptSession | null>(null);

  const fetchOrder = async () => {
    if (!orderId || !restaurant?.id) return;

    try {
      const { data, error } = await supabase
        .from('tb_order_temporary')
        .select('*')
        .eq('id', orderId)
        .eq('shop_id', restaurant.id)
        .single();

      if (error) throw error;

      // Get table number if dine-in
      let tableNumber: string | undefined;
      if (data.table_id) {
        const { data: tableData } = await supabase
          .from('tables')
          .select('table_number')
          .eq('id', data.table_id)
          .single();
        tableNumber = tableData?.table_number;
      }

      // Parse items - include special_request field
      const items: StoredOrderItem[] = Array.isArray(data.items)
        ? (data.items as unknown[]).filter((item: any) => item.item_id).map((item: any) => ({
          item_id: item.item_id || '',
          menu_item_id: item.menu_item_id || '',
          name: item.name || '',
          price: item.price || 0,
          options: item.options || [],
          status: item.status || 'pending',
          created_at: item.created_at || data.created_at,
          category_name: item.category_name,
          special_request: item.special_request || null,
        }))
        : [];

      setOrder({
        id: data.id,
        shop_id: data.shop_id,
        device_id: data.device_id,
        status: data.status,
        total_usd: data.total_usd || 0,
        customer_notes: data.customer_notes,
        items,
        order_type: data.order_type || 'takeaway',
        table_id: data.table_id,
        table_number: tableNumber,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
    } catch (error: any) {
      console.error('Error fetching order:', error);
      toast.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Real-time subscription
    if (!orderId || !restaurant?.id) return;

    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tb_order_temporary',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            // Order was paid/removed, go back
            toast.info('Order has been completed');
            navigate('/admin/customer-orders');
          } else {
            fetchOrder();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, restaurant?.id]);

  const updateItemStatus = async (itemIds: string[], newStatus: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase.rpc('update_order_items_status', {
        p_order_id: order.id,
        p_item_ids: itemIds,
        p_new_status: newStatus,
      });

      if (error) throw error;

      const response = data as { success: boolean; error?: string };
      if (!response.success) throw new Error(response.error);

      toast.success(`Items marked as ${newStatus}`);
      fetchOrder();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const cancelOrder = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tb_order_temporary')
        .delete()
        .eq('id', order.id)
        .eq('shop_id', order.shop_id);

      if (error) throw error;

      toast.success('Order cancelled successfully');
      navigate('/admin/customer-orders');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setUpdating(false);
    }
  };

  const markAsPaid = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase.rpc('mark_order_paid', {
        p_order_id: order.id,
      });

      if (error) throw error;

      const response = data as { success: boolean; error?: string };
      if (!response.success) throw new Error(response.error);

      toast.success('Order marked as paid');
      navigate('/admin/customer-orders');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as paid');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground mb-4">Order not found</p>
        <Button onClick={() => navigate('/admin/customer-orders')}>
          Back to Orders
        </Button>
      </div>
    );
  }

  const rounds = groupItemsIntoRounds(order.items, order.customer_notes);
  const subtotal = calculateOrderTotal(order.items);
  // Tax calculation - can be enhanced if restaurant settings are fetched
  const taxRate = 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const isDineIn = order.order_type === 'dine_in';

  // Generate order short ID from last 4 digits of created_at timestamp
  const match = order.created_at.match(/\.(\d+)/);
  const shortId = `#${match[1].slice(-4)}`;

  // Build ReceiptSession from order data for receipt display
  const buildReceiptSession = async (): Promise<ReceiptSession> => {
    // Fetch full restaurant details for the receipt
    const { data: rest } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', order.shop_id)
      .single();

    return {
      session_id: order.id,
      table_id: order.table_id || '',
      table_number: order.table_number || 'N/A',
      restaurant_id: order.shop_id,
      restaurant_name: rest?.name || restaurant?.name || '',
      restaurant_phone: rest?.phone || null,
      restaurant_address: rest?.address || null,
      restaurant_city: rest?.city || null,
      restaurant_country: rest?.country || null,
      restaurant_logo_url: rest?.logo_url || null,
      restaurant_vat_tin: rest?.vat_tin || null,
      default_tax_percentage: rest?.default_tax_percentage || 0,
      service_charge_percentage: rest?.service_charge_percentage || 0,
      exchange_rate_usd_to_khr: rest?.exchange_rate_usd_to_khr || 4100,
      receipt_header_text: rest?.receipt_header_text || null,
      receipt_footer_text: rest?.receipt_footer_text || null,
      currency: rest?.currency || 'USD',
      status: 'open',
      started_at: order.created_at,
      ended_at: null,
      total_amount: subtotal,
      order_type: order.order_type,
      invoice_number: null,
      cashier_name: null,
      orders: [{
        id: order.id,
        total_usd: subtotal,
        status: order.status,
        created_at: order.created_at,
        customer_notes: order.customer_notes,
        items: order.items
          .filter(i => i.status !== 'rejected')
          .map(i => ({
            id: i.item_id,
            quantity: 1,
            price_usd: i.price,
            notes: i.options && i.options.length > 0
              ? JSON.stringify({ selectedOptions: i.options.map(o => ({ group: o.groupName, value: o.label, price: o.price })) })
              : null,
            menu_item_name: i.name,
          })),
      }],
    };
  };


  const handleOpenReceipt = async () => {
    const session = await buildReceiptSession();
    setReceiptSession(session);
    setReceiptOpen(true);
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/customer-orders')}
            className="gap-2 hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-l font-bold">Order Detail</h1>
            <p className="text-sm text-muted-foreground">
              {shortId} • {rounds.length} Round{rounds.length !== 1 ? 's' : ''} •
              {isDineIn ? ` Table ${order.table_number || 'N/A'}` : ' Takeaway'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                {statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                All Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                <Clock className="h-4 w-4 mr-2" /> Pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('preparing')}>
                <ChefHat className="h-4 w-4 mr-2" /> Preparing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('ready')}>
                <CheckCircle className="h-4 w-4 mr-2" /> Ready
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('rejected')}>
                <XCircle className="h-4 w-4 mr-2" /> Rejected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge
            variant="outline"
            className="gap-2 bg-green-50 text-green-700 border-green-200"
          >
            <span className="h-2 w-2 rounded-full bg-green-500" />
            ACTIVE SESSION
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content - Order Rounds */}
        <div className="lg:col-span-2 space-y-4">
          {rounds.map((round) => {
            const filteredRoundItems = statusFilter === 'all'
              ? round.items
              : round.items.filter(i => (i.status || 'pending') === statusFilter);
            if (filteredRoundItems.length === 0) return null;
            const groupedItems = groupRoundItems(filteredRoundItems);
            const roundTime = format(new Date(round.timestamp), 'h:mm a');

            return (
              <Card key={round.roundNumber}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-medium">
                        Round {round.roundNumber}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{roundTime}</span>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase">
                      {round.items.length} item{round.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Items */}
                  {groupedItems.map((item, idx) => {
                    const itemTotal = (item.price + (item.options?.reduce((s, o) => s + o.price, 0) || 0)) * item.count;
                    const isRejected = item.status === 'rejected';

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between py-2 ${isRejected ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-primary font-semibold">{item.count}×</span>
                          <div>
                            <p className={`font-medium ${isRejected ? 'line-through' : ''}`}>
                              {item.name}
                            </p>
                            {item.category_name && (
                              <p className="text-sm text-muted-foreground">{item.category_name}</p>
                            )}
                            {item.options && item.options.length > 0 && (
                              <div className="text-xs text-muted-foreground space-y-1">
                                {Object.entries(
                                  item.options.reduce((acc, option) => {
                                    if (!acc[option.groupName]) {
                                      acc[option.groupName] = [];
                                    }
                                    acc[option.groupName].push(option.label);
                                    return acc;
                                  }, {} as Record<string, string[]>)
                                ).map(([group, labels]) => (
                                  <div key={group}>
                                    <span className="font-medium">{group}:</span> {labels.join(', ')}
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={updating}
                                className="h-7 px-2 hover:bg-transparent"
                              >
                                <StatusBadge status={item.status} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateItemStatus(item.item_ids, 'pending')}>
                                <Clock className="h-4 w-4 mr-2" /> Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateItemStatus(item.item_ids, 'preparing')}>
                                <ChefHat className="h-4 w-4 mr-2" /> Preparing
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateItemStatus(item.item_ids, 'ready')}>
                                <CheckCircle className="h-4 w-4 mr-2" /> Ready
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateItemStatus(item.item_ids, 'rejected')}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" /> Reject
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <span className={`font-medium min-w-[60px] text-right ${isRejected ? 'line-through' : ''}`}>
                            ${itemTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Special Request for this round */}
                  {round.specialRequest && (
                    <div className="mt-4 flex items-start gap-3 bg-muted-foreground/5 rounded-lg p-3">
                      <div className="h-6 w-6 rounded-lg bg-muted-foreground/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-muted-foreground tracking-wide">
                          Special Request
                        </p>

                        <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap leading-relaxed">
                          {round.specialRequest}
                        </p>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Sidebar - Order Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({order.items.filter(i => i.status !== 'rejected').length} items)</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Tax ({taxRate}%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total Amount</span>
                <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              className="flex-1 gap-2 text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive"
              size="sm"
              variant="outline"
              onClick={() => setConfirmCancelOpen(true)}
              disabled={updating}
            >
              <XCircle className="h-4 w-4" />
              Cancel Order
            </Button>

            <Button
              className="flex-1 gap-2 text-green-500 border-green-500 hover:bg-green-500/10 hover:text-green-500"
              size="sm"
              variant="outline"
              onClick={() => setConfirmPaidOpen(true)}
              disabled={updating}
            >
              <DollarSign className="h-4 w-4" />
              Paid
            </Button>

            <Button
              variant="outline"
              className="flex-1 gap-2 text-blue-500 border-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
              size="sm"
              onClick={handleOpenReceipt}
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </Button>
          </div>

          {/* Activity History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Activity History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rounds.slice().reverse().map((round, idx) => (
                  <div key={round.roundNumber} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-2 w-2 p-1 rounded-full ${idx === 0 ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                      {idx !== rounds.length - 1 && (
                        <div className="w-px h-full bg-muted-foreground/20 mt-1" />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-medium">
                        {round.roundNumber === 1 ? 'First Order Round (#1)' : `New Order Round (#${round.roundNumber})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(round.timestamp), 'dd MMM, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPaidOpen}
        onOpenChange={setConfirmPaidOpen}
        title="Mark Order as Paid"
        description="Are you sure you want to mark this order as paid? This action cannot be undone."
        confirmLabel="Mark as Paid"
        variant="destructive"
        onConfirm={markAsPaid}
        loading={updating}
      />

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? This will permanently remove the order and cannot be undone."
        confirmLabel="Cancel Order"
        variant="destructive"
        onConfirm={cancelOrder}
        loading={updating}
      />

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0" hideCloseButton>
          <DialogHeader className="px-6 pt-3 pb-0 flex flex-row items-center justify-between">
            <DialogTitle className="text-base">Receipt Preview</DialogTitle>
            <ReceiptActions
              receiptRef={receiptRef as React.RefObject<HTMLDivElement>}
              sessionId={order.id}
              isPaid={false}
              showPayButton={false}
              onClose={() => setReceiptOpen(false)}
            />
          </DialogHeader>
          <div className="px-2 pb-4">
            {receiptSession && (
              <SessionReceipt
                ref={receiptRef}
                session={receiptSession}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Pending
        </Badge>
      );
    case 'preparing':
      return (
        <Badge variant="secondary" className="text-xs gap-1 bg-yellow-100 text-yellow-700">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" /> Preparing
        </Badge>
      );
    case 'ready':
      return (
        <Badge className="text-xs gap-1 bg-green-100 text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Ready
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="h-3 w-3" /> Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};

export default OrderDetail;

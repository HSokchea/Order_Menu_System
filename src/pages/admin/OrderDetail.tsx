import { useState, useEffect } from 'react';
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
  StoredOrderItem,
  groupItemsIntoRounds,
  groupRoundItems,
  calculateOrderTotal
} from '@/types/order';
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
                              <p className="text-xs text-muted-foreground">
                                {item.options.map(o => o.label).join(', ')}
                              </p>
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
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" size="sm">
              <Printer className="h-4 w-4" />
              Print Receipt
            </Button>
            <Button
              className="flex-1 gap-2"
              size="sm"
              onClick={() => setConfirmPaidOpen(true)}
              disabled={updating}
            >
              <DollarSign className="h-4 w-4" />
              Mark as Paid
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
      />
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

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  ChefHat, 
  Store, 
  UtensilsCrossed,
  Bell,
  Package,
  XCircle,
  DollarSign,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StoredOrderItem, groupOrderItems, calculateOrderTotal } from '@/types/order';

interface CustomerOrder {
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

const CustomerOrders = () => {
  const { restaurant } = useUserProfile();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'dine_in' | 'takeaway'>('all');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const fetchOrders = async () => {
    if (!restaurant?.id) return;

    setLoading(true);
    try {
      // Fetch orders from tb_his_admin (active placed orders)
      const { data: historyOrders, error: historyError } = await supabase
        .from('tb_his_admin')
        .select('*')
        .eq('shop_id', restaurant.id)
        .in('status', ['placed', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;

      // Fetch table numbers for dine-in orders
      const tableIds = (historyOrders || [])
        .filter(o => o.table_id)
        .map(o => o.table_id as string);

      let tableMap: Record<string, string> = {};
      if (tableIds.length > 0) {
        const { data: tables } = await supabase
          .from('tables')
          .select('id, table_number')
          .in('id', tableIds);

        tableMap = (tables || []).reduce((acc, t) => {
          acc[t.id] = t.table_number;
          return acc;
        }, {} as Record<string, string>);
      }

      // Map orders with proper types
      const mappedOrders: CustomerOrder[] = (historyOrders || []).map(order => {
        // Parse items from JSON
        const items: StoredOrderItem[] = Array.isArray(order.items)
          ? (order.items as unknown as StoredOrderItem[]).map(item => ({
              item_id: (item as any).item_id || '',
              menu_item_id: (item as any).menu_item_id || '',
              name: (item as any).name || '',
              price: (item as any).price || 0,
              options: (item as any).options || [],
              status: (item as any).status || 'pending',
              created_at: (item as any).created_at || '',
            }))
          : [];

        return {
          id: order.id,
          shop_id: order.shop_id,
          device_id: order.device_id,
          status: order.status,
          total_usd: order.total_usd || 0,
          customer_notes: order.customer_notes,
          items,
          order_type: order.order_type || 'takeaway',
          table_id: order.table_id || null,
          table_number: order.table_id ? (order.table_number || tableMap[order.table_id]) : undefined,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
      });

      setOrders(mappedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Real-time subscription
    if (!restaurant?.id) return;

    const channel = supabase
      .channel('customer-orders-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tb_his_admin',
          filter: `shop_id=eq.${restaurant.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Filter orders by type
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    return order.order_type === activeTab;
  });

  // Group dine-in orders by table
  const groupedByTable = filteredOrders
    .filter(o => o.order_type === 'dine_in')
    .reduce((acc, order) => {
      const key = order.table_number || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {} as Record<string, CustomerOrder[]>);

  // Get takeaway orders
  const takeawayOrders = filteredOrders.filter(o => o.order_type === 'takeaway');

  // Stats
  const stats = {
    total: orders.length,
    dineIn: orders.filter(o => o.order_type === 'dine_in').length,
    takeaway: orders.filter(o => o.order_type === 'takeaway').length,
    totalRevenue: orders.reduce((sum, o) => sum + (o.total_usd || 0), 0),
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Customer Orders
          </h2>
          <p className="text-muted-foreground">
            Manage QR orders with item-level status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dine-in</p>
                <p className="text-2xl font-bold">{stats.dineIn}</p>
              </div>
              <UtensilsCrossed className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Takeaway</p>
                <p className="text-2xl font-bold">{stats.takeaway}</p>
              </div>
              <Store className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <Bell className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            All ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="dine_in" className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Dine-in ({stats.dineIn})
          </TabsTrigger>
          <TabsTrigger value="takeaway" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Takeaway ({stats.takeaway})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {orders.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  expanded={expandedOrders.has(order.id)}
                  onToggle={() => toggleOrderExpanded(order.id)}
                  onRefresh={fetchOrders}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dine_in" className="mt-6">
          {stats.dineIn === 0 ? (
            <EmptyState message="No dine-in orders yet" />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByTable).map(([tableNumber, tableOrders]) => (
                <div key={tableNumber}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5" />
                    Table {tableNumber}
                    <Badge variant="secondary">{tableOrders.length} order(s)</Badge>
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tableOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order}
                        expanded={expandedOrders.has(order.id)}
                        onToggle={() => toggleOrderExpanded(order.id)}
                        onRefresh={fetchOrders}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="takeaway" className="mt-6">
          {stats.takeaway === 0 ? (
            <EmptyState message="No takeaway orders yet" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {takeawayOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order}
                  expanded={expandedOrders.has(order.id)}
                  onToggle={() => toggleOrderExpanded(order.id)}
                  onRefresh={fetchOrders}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ message = "No active orders" }: { message?: string }) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium">{message}</p>
      <p className="text-muted-foreground">Orders will appear here when customers scan and order</p>
    </CardContent>
  </Card>
);

// Order Card Component
interface OrderCardProps {
  order: CustomerOrder;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}

const OrderCard = ({ order, expanded, onToggle, onRefresh }: OrderCardProps) => {
  const [updating, setUpdating] = useState(false);
  const orderTime = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });
  const isDineIn = order.order_type === 'dine_in';

  // Group items by status for summary
  const groupedItems = groupOrderItems(order.items);
  const statusCounts = {
    pending: order.items.filter(i => i.status === 'pending').length,
    preparing: order.items.filter(i => i.status === 'preparing').length,
    ready: order.items.filter(i => i.status === 'ready').length,
    rejected: order.items.filter(i => i.status === 'rejected').length,
  };

  const updateItemStatus = async (itemIds: string[], newStatus: string) => {
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
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const markAsPaid = async () => {
    setUpdating(true);
    try {
      const { data, error } = await supabase.rpc('mark_order_paid', {
        p_order_id: order.id,
      });

      if (error) throw error;

      const response = data as { success: boolean; error?: string };
      if (!response.success) throw new Error(response.error);

      toast.success('Order marked as paid');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as paid');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className={`border-l-4 ${isDineIn ? 'border-l-blue-500' : 'border-l-green-500'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isDineIn ? (
              <>
                <UtensilsCrossed className="h-4 w-4 text-blue-500" />
                Table {order.table_number || 'N/A'}
              </>
            ) : (
              <>
                <Store className="h-4 w-4 text-green-500" />
                Takeaway
              </>
            )}
          </CardTitle>
          <Badge variant={order.status === 'placed' ? 'secondary' : 'default'}>
            {order.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {orderTime}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status Summary */}
        <div className="flex flex-wrap gap-2 text-xs">
          {statusCounts.pending > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Pending: {statusCounts.pending}
            </Badge>
          )}
          {statusCounts.preparing > 0 && (
            <Badge variant="secondary" className="gap-1">
              <ChefHat className="h-3 w-3" /> Preparing: {statusCounts.preparing}
            </Badge>
          )}
          {statusCounts.ready > 0 && (
            <Badge className="gap-1 bg-green-500">
              <CheckCircle className="h-3 w-3" /> Ready: {statusCounts.ready}
            </Badge>
          )}
          {statusCounts.rejected > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" /> Rejected: {statusCounts.rejected}
            </Badge>
          )}
        </div>

        {/* Expandable Items List */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between"
          onClick={onToggle}
        >
          <span>{order.items.length} items</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {expanded && (
          <div className="space-y-2 border rounded-md p-2">
            {groupedItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <span className={item.status === 'rejected' ? 'line-through text-muted-foreground' : ''}>
                    {item.count}× {item.name}
                  </span>
                  {item.options.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.options.map(o => o.label).join(', ')}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      disabled={updating}
                      className="h-7 px-2"
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
              </div>
            ))}
          </div>
        )}

        {/* Customer Notes */}
        {order.customer_notes && (
          <div className="bg-muted/50 rounded p-2 text-sm">
            <span className="text-muted-foreground">Note: </span>
            {order.customer_notes}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="font-medium">Total</span>
          <span className="font-bold text-lg">${order.total_usd?.toFixed(2) || '0.00'}</span>
        </div>

        {/* Mark as Paid Button */}
        <Button 
          className="w-full" 
          onClick={markAsPaid}
          disabled={updating}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Mark as Paid
        </Button>
      </CardContent>
    </Card>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case 'preparing':
      return <Badge variant="secondary" className="text-xs"><ChefHat className="h-3 w-3 mr-1" />Preparing</Badge>;
    case 'ready':
      return <Badge className="text-xs bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};

export default CustomerOrders;
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Package
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderItem {
  id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price_usd: number;
  options?: Array<{ groupName: string; label: string; price: number }>;
  notes?: string;
}

interface CustomerOrder {
  id: string;
  shop_id: string;
  device_id: string;
  status: string;
  total_usd: number;
  customer_notes: string | null;
  items: OrderItem[];
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

  const fetchOrders = async () => {
    if (!restaurant?.id) return;

    setLoading(true);
    try {
      // Fetch temporary orders (pending) - cast to any to handle new columns not yet in types
      const { data: tempOrders, error: tempError } = await supabase
        .from('tb_order_temporary')
        .select('*')
        .eq('shop_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (tempError) throw tempError;

      // Cast to access new columns (order_type, table_id) that may not be in generated types yet
      const ordersWithNewColumns = (tempOrders || []) as Array<{
        id: string;
        shop_id: string;
        device_id: string;
        status: string;
        total_usd: number | null;
        customer_notes: string | null;
        items: any;
        order_type?: string;
        table_id?: string | null;
        created_at: string;
        updated_at: string;
      }>;

      // Fetch table numbers for dine-in orders
      const tableIds = ordersWithNewColumns
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

      // Map orders with table numbers
      const mappedOrders: CustomerOrder[] = ordersWithNewColumns.map(order => ({
        id: order.id,
        shop_id: order.shop_id,
        device_id: order.device_id,
        status: order.status,
        total_usd: order.total_usd || 0,
        customer_notes: order.customer_notes,
        items: Array.isArray(order.items) ? order.items : [],
        order_type: order.order_type || 'takeaway',
        table_id: order.table_id || null,
        table_number: order.table_id ? tableMap[order.table_id] : undefined,
        created_at: order.created_at,
        updated_at: order.updated_at,
      }));
      console.log("customer: ", mappedOrders)
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
      .channel('customer-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tb_order_temporary',
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
            Real-time orders from QR menu scanning
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
                <p className="text-sm text-muted-foreground">Total Orders</p>
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
                <OrderCard key={order.id} order={order} />
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
                      <OrderCard key={order.id} order={order} />
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
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Empty State Component
const EmptyState = ({ message = "No pending orders" }: { message?: string }) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium">{message}</p>
      <p className="text-muted-foreground">Orders will appear here when customers scan and order</p>
    </CardContent>
  </Card>
);

// Order Card Component
const OrderCard = ({ order }: { order: CustomerOrder }) => {
  const orderTime = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });
  const isDineIn = order.order_type === 'dine_in';

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
          <Badge variant={order.status === 'pending' ? 'secondary' : 'default'}>
            {order.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {orderTime}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Order Items */}
        <div className="space-y-1">
          {order.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="font-medium text-primary">{item.quantity}×</span>
              <span className="flex-1">{item.name}</span>
              <span className="text-muted-foreground">${(item.price_usd * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-xs text-muted-foreground">
              +{order.items.length - 3} more item(s)
            </p>
          )}
        </div>

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

        {/* Device ID (truncated) */}
        <p className="text-xs text-muted-foreground truncate">
          Device: {order.device_id.substring(0, 8)}...
        </p>
      </CardContent>
    </Card>
  );
};

export default CustomerOrders;
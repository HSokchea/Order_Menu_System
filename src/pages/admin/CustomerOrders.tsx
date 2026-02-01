import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  CheckCircle, 
  UtensilsCrossed,
  Package,
  Store,
  DollarSign
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StoredOrderItem } from '@/types/order';
import OrderCard from '@/components/admin/orders/OrderCard';

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
  const navigate = useNavigate();
  const { restaurant } = useUserProfile();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'dine_in' | 'takeaway'>('all');

  const fetchOrders = async () => {
    if (!restaurant?.id) return;

    setLoading(true);
    try {
      // Fetch orders from tb_order_temporary (active placed orders)
      const { data: tempOrders, error: tempError } = await supabase
        .from('tb_order_temporary')
        .select('*')
        .eq('shop_id', restaurant.id)
        .eq('status', 'placed')
        .order('updated_at', { ascending: false });

      if (tempError) throw tempError;

      // Fetch table numbers for dine-in orders
      const tableIds = (tempOrders || [])
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
      const mappedOrders: CustomerOrder[] = (tempOrders || []).map(order => {
        // Parse items from JSON - handle both cart format and expanded format
        const items: StoredOrderItem[] = Array.isArray(order.items)
          ? (order.items as unknown[]).filter((item: any) => item.item_id).map((item: any) => ({
              item_id: item.item_id || '',
              menu_item_id: item.menu_item_id || '',
              name: item.name || '',
              price: item.price || 0,
              options: item.options || [],
              status: item.status || 'pending',
              created_at: item.created_at || order.created_at,
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
          table_number: order.table_id ? tableMap[order.table_id] : undefined,
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

    // Real-time subscription to tb_order_temporary
    if (!restaurant?.id) return;

    const channel = supabase
      .channel('customer-orders-admin')
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

  const handleOrderClick = (orderId: string) => {
    navigate(`/admin/customer-orders/${orderId}`);
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
              <DollarSign className="h-8 w-8 text-yellow-500 opacity-50" />
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
                  onClick={() => handleOrderClick(order.id)}
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
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tableOrders.map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order}
                        onClick={() => handleOrderClick(order.id)}
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
                  onClick={() => handleOrderClick(order.id)}
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

export default CustomerOrders;

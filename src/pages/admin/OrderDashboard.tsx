import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, ChefHat, CheckCircle, Truck } from 'lucide-react';


interface OrderItem {
  id: string;
  quantity: number;
  price_usd: number;
  menu_item: {
    name: string;
  };
}

interface Order {
  id: string;
  table_number: string;
  status: string;
  total_usd: number;
  customer_notes?: string;
  created_at: string;
  order_items: OrderItem[];
}

const OrderDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!restaurant) return;

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          price_usd,
          menu_item:menu_items (name)
        )
      `)
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false });

    setOrders(ordersData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Set up real-time subscription for orders
    if (!user) return;

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Order status updated",
      });
      fetchOrders();
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'new':
        return {
          color: 'bg-warning text-warning-foreground',
          label: 'New Order',
          icon: <Clock className="h-4 w-4" />,
          next: 'preparing'
        };
      case 'preparing':
        return {
          color: 'bg-primary text-primary-foreground',
          label: 'Preparing',
          icon: <ChefHat className="h-4 w-4" />,
          next: 'ready'
        };
      case 'ready':
        return {
          color: 'bg-success text-success-foreground',
          label: 'Ready',
          icon: <Truck className="h-4 w-4" />,
          next: 'completed'
        };
      case 'completed':
        return {
          color: 'bg-muted text-muted-foreground',
          label: 'Completed',
          icon: <CheckCircle className="h-4 w-4" />,
          next: null
        };
      default:
        return {
          color: 'bg-secondary text-secondary-foreground',
          label: 'Unknown',
          icon: <Clock className="h-4 w-4" />,
          next: null
        };
    }
  };

  const getNextStepLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case 'new':
        return 'Start Preparing';
      case 'preparing':
        return 'Mark Ready';
      case 'ready':
        return 'Mark Completed';
      default:
        return null;
    }
  };

  const isOrderActive = (status: string) => {
    return ['new', 'preparing', 'ready'].includes(status);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">{/* Active Orders Section */}
        {/* Active Orders Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Active Orders</h2>
          <div className="grid gap-4">
            {orders.filter(order => isOrderActive(order.status)).length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active orders</p>
                  <p className="text-sm text-muted-foreground">New orders will appear here</p>
                </CardContent>
              </Card>
            ) : (
              orders
                .filter(order => isOrderActive(order.status))
                .map((order) => {
                  const statusConfig = getStatusConfig(order.status);
                  const nextStepLabel = getNextStepLabel(order.status);
                  
                  return (
                    <Card key={order.id} className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-3">
                              <span className="text-lg">Table {order.table_number}</span>
                              <Badge className={`${statusConfig.color} gap-1.5 px-3 py-1`}>
                                {statusConfig.icon}
                                {statusConfig.label}
                              </Badge>
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                              <span>Order #{order.id.slice(-6).toUpperCase()}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-foreground">${order.total_usd.toFixed(2)}</p>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Order Items */}
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-medium text-sm mb-3 text-muted-foreground uppercase tracking-wider">Items</h4>
                          <div className="space-y-2">
                            {order.order_items.map((item) => (
                              <div key={item.id} className="flex justify-between items-center">
                                <span className="font-medium">
                                  <span className="inline-flex items-center justify-center w-6 h-6 bg-primary/10 text-primary rounded-full text-sm mr-2">
                                    {item.quantity}
                                  </span>
                                  {item.menu_item.name}
                                </span>
                                <span className="font-semibold">${(item.quantity * item.price_usd).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Customer Notes */}
                        {order.customer_notes && (
                          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                            <h4 className="font-medium text-sm mb-2 text-warning-foreground">Customer Notes</h4>
                            <p className="text-sm text-foreground">{order.customer_notes}</p>
                          </div>
                        )}

                        {/* Action Button */}
                        {nextStepLabel && statusConfig.next && (
                          <div className="pt-2">
                            <Button
                              className="w-full h-12 text-base font-semibold"
                              onClick={() => updateOrderStatus(order.id, statusConfig.next!)}
                            >
                              {nextStepLabel}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </div>
        </div>

        {/* Completed Orders Section */}
        {orders.filter(order => order.status === 'completed').length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-foreground">Recently Completed</h2>
            <div className="grid gap-3">
              {orders
                .filter(order => order.status === 'completed')
                .slice(0, 5)
                .map((order) => {
                  const statusConfig = getStatusConfig(order.status);
                  
                  return (
                    <Card key={order.id} className="opacity-75 hover:opacity-100 transition-opacity">
                      <CardContent className="py-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Badge className={`${statusConfig.color} gap-1`}>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </Badge>
                            <span className="font-medium">Table {order.table_number}</span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(order.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="font-semibold">${order.total_usd.toFixed(2)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              }
            </div>
          </div>
        )}
    </div>
  );
};

export default OrderDashboard;
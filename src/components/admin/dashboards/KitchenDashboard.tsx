import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { Clock, ChefHat, CheckCircle, Bell, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface OrderItem {
  id: string;
  quantity: number;
  notes: string | null;
  menu_item: {
    name: string;
  };
}

interface Order {
  id: string;
  table_number: string;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

export const KitchenDashboard = () => {
  const { restaurant } = useUserProfile();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!restaurant?.id) return;

    const { data: ordersData, error } = await supabase
      .from('orders')
      .select(`
        id,
        table_number,
        status,
        created_at,
        order_items (
          id,
          quantity,
          notes,
          menu_item:menu_items (name)
        )
      `)
      .eq('restaurant_id', restaurant.id)
      .in('status', ['new', 'preparing'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      setOrders(ordersData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Set up real-time subscription
    if (!restaurant?.id) return;

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`
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
        description: `Order marked as ${status}`,
      });
      fetchOrders();
    }
  };

  const newOrders = orders.filter(o => o.status === 'new');
  const preparingOrders = orders.filter(o => o.status === 'preparing');

  if (loading) {
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
            <ChefHat className="h-6 w-6" />
            Kitchen Orders
          </h2>
          <p className="text-muted-foreground">
            {newOrders.length} new • {preparingOrders.length} preparing
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-muted-foreground">No pending orders at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* New Orders Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Bell className="h-5 w-5 text-warning" />
              <h3 className="font-semibold">New Orders ({newOrders.length})</h3>
            </div>
            {newOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onStart={() => updateOrderStatus(order.id, 'preparing')}
              />
            ))}
          </div>

          {/* Preparing Column */}
          <div className="space-y-4 md:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 px-2">
              <ChefHat className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Preparing ({preparingOrders.length})</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {preparingOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onComplete={() => updateOrderStatus(order.id, 'ready')}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface OrderCardProps {
  order: Order;
  onStart?: () => void;
  onComplete?: () => void;
}

const OrderCard = ({ order, onStart, onComplete }: OrderCardProps) => {
  const isNew = order.status === 'new';
  const orderTime = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });

  return (
    <Card className={`border-l-4 ${isNew ? 'border-l-warning' : 'border-l-primary'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Table {order.table_number}</CardTitle>
          <Badge variant={isNew ? 'secondary' : 'default'}>
            {isNew ? 'New' : 'Preparing'}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {orderTime}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Items - No prices shown */}
        <div className="space-y-2">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <span className="font-bold text-primary min-w-[24px]">{item.quantity}×</span>
              <div className="flex-1">
                <span className="font-medium">{item.menu_item.name}</span>
                {item.notes && (
                  <p className="text-sm text-muted-foreground mt-0.5">{item.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        {isNew ? (
          <Button className="w-full" onClick={onStart}>
            <ChefHat className="h-4 w-4 mr-2" />
            Start Preparing
          </Button>
        ) : (
          <Button className="w-full" variant="default" onClick={onComplete}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Ready
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

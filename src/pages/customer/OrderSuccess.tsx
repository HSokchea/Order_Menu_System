import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock } from 'lucide-react';

interface OrderDetails {
  id: string;
  table_number: string;
  total_usd: number;
  status: string;
  created_at: string;
  restaurant: {
    name: string;
  };
}

const OrderSuccess = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tableId, setTableId] = useState<string>('');
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch order details
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;

      // Get token from URL or localStorage
      let orderToken = searchParams.get('token');
      if (!orderToken) {
        const storedTokens = JSON.parse(localStorage.getItem('order_tokens') || '{}');
        orderToken = storedTokens[orderId] || null;
      }

      // Call RPC with token for secure access
      const { data, error } = await supabase.rpc('get_order_details', { 
        p_order_id: orderId,
        p_order_token: orderToken
      });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setOrder(null);
        setLoading(false);
        return;
      }

      const details: any = Array.isArray(data) ? data[0] : data;
      const mapped: OrderDetails = {
        id: details.id,
        table_number: details.table_number,
        total_usd: Number(details.total_usd || 0),
        status: details.status,
        created_at: details.created_at,
        restaurant: { name: details.restaurant_name }
      };

      setOrder(mapped);
      setTableId(details.table_id);
      setLoading(false);
    };

    fetchOrder();
  }, [orderId, searchParams]);

  // Separate effect for realtime subscription
  useEffect(() => {
    if (!orderId) return;

    const channelName = `order-status-${orderId}`;
    console.log('Setting up realtime channel for order:', channelName);
    
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          console.log('Realtime order status update received:', payload);
          console.log('New status:', payload.new.status);
          setOrder(prev => prev ? { ...prev, status: payload.new.status as string } : null);
        }
      )
      .subscribe((status, err) => {
        console.log('OrderSuccess realtime subscription status:', status);
        if (err) {
          console.error('Realtime subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to order', orderId, 'updates');
        }
      });

    return () => {
      console.log('Removing order status channel:', channelName);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Your order has been received and is being reviewed.';
      case 'preparing':
        return 'Your order is being prepared in the kitchen.';
      case 'ready':
        return 'Your order is ready for pickup!';
      case 'completed':
        return 'Your order has been completed.';
      default:
        return 'Processing your order...';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-success" />;
      default:
        return <Clock className="h-8 w-8 text-primary" />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
          <p className="text-muted-foreground">The order ID may be invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Card */}
        <div className="flex items-center justify-center mb-8">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                {getStatusIcon(order.status)}
              </div>
              <CardTitle className="text-2xl">Thank You!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-lg font-semibold mb-2">
                  Order #{order.id.slice(-8).toUpperCase()}
                </p>
                <p className="text-muted-foreground">
                  {order.restaurant.name} - Table {order.table_number}
                </p>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg text-center">
                <p className="font-medium">{getStatusMessage(order.status)}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Order Total:</span>
                  <span className="font-semibold">${order.total_usd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Order Time:</span>
                  <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="capitalize font-medium">{order.status}</span>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>Please wait at your table. We'll bring your order when it's ready.</p>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate(tableId ? `/menu/${tableId}` : '/')}
              >
                Back to Menu
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default OrderSuccess;
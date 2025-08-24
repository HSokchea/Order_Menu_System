import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ChefHat, Clock, CheckCircle, ArrowLeft, Package2, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrders } from '@/hooks/useActiveOrders';

interface OrderItem {
  id: string;
  quantity: number;
  price_usd: number;
  menu_item_name: string;
  notes?: string;
  is_available: boolean;
}

const MyOrders = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { activeOrders, loading } = useActiveOrders(tableId || '');
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Fetch order items for each order
  useEffect(() => {
    const fetchOrderItems = async () => {
      const itemsMap: Record<string, OrderItem[]> = {};
      
      for (const order of activeOrders) {
        try {
          const { data: items, error } = await supabase
            .from('order_items')
            .select(`
              id,
              quantity,
              price_usd,
              notes,
              menu_items:menu_item_id (name, is_available)
            `)
            .eq('order_id', order.id);

          if (!error && items) {
            itemsMap[order.id] = items.map(item => ({
              id: item.id,
              quantity: item.quantity,
              price_usd: Number(item.price_usd || 0),
              menu_item_name: (item.menu_items as any)?.name || 'Unknown Item',
              notes: item.notes || undefined,
              is_available: (item.menu_items as any)?.is_available ?? true
            }));
          }
        } catch (error) {
          console.error('Error fetching order items:', error);
        }
      }
      
      setOrderItems(itemsMap);
    };

    if (activeOrders.length > 0) {
      fetchOrderItems();
    }
  }, [activeOrders]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'new':
        return {
          label: 'Order Received',
          icon: <Clock className="h-5 w-5" />,
          progress: 25,
          color: 'bg-blue-500',
          variant: 'secondary' as const,
          description: 'Your order has been received and is being processed'
        };
      case 'preparing':
        return {
          label: 'Preparing',
          icon: <ChefHat className="h-5 w-5" />,
          progress: 75,
          color: 'bg-orange-500',
          variant: 'default' as const,
          description: 'The kitchen is preparing your delicious meal'
        };
      case 'ready':
        return {
          label: 'Ready for Pickup!',
          icon: <CheckCircle className="h-5 w-5" />,
          progress: 100,
          color: 'bg-green-500',
          variant: 'default' as const,
          description: 'Your order is ready! Please collect it from the counter'
        };
      case 'cancelled':
      case 'disabled':
        return {
          label: 'Order Cancelled',
          icon: <XCircle className="h-5 w-5" />,
          progress: 0,
          color: 'bg-destructive',
          variant: 'destructive' as const,
          description: 'This order has been cancelled. Please contact staff for assistance.'
        };
      case 'completed':
        return {
          label: 'Completed',
          icon: <CheckCircle className="h-5 w-5" />,
          progress: 100,
          color: 'bg-green-500',
          variant: 'default' as const,
          description: 'Your order has been completed successfully'
        };
      default:
        return {
          label: 'Processing',
          icon: <Clock className="h-5 w-5" />,
          progress: 10,
          color: 'bg-gray-500',
          variant: 'secondary' as const,
          description: 'Processing your order'
        };
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // The useActiveOrders hook will automatically refresh, so we just need to wait a moment
    setTimeout(() => setRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-background dark:to-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Package2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">Loading your orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-background dark:to-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/menu/${tableId}`)}
                className="h-9 w-9 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-primary">My Orders</h1>
                <p className="text-xs text-muted-foreground">Table {tableId}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 w-9 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {activeOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package2 className="h-24 w-24 mx-auto mb-6 text-muted-foreground/50" />
            <h2 className="text-2xl font-semibold mb-2">No Active Orders</h2>
            <p className="text-muted-foreground mb-6">
              You don't have any active orders at the moment.
            </p>
            <Button onClick={() => navigate(`/menu/${tableId}`)}>
              Browse Menu
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Active Orders ({activeOrders.length})
              </h2>
            </div>

            {activeOrders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const items = orderItems[order.id] || [];

              return (
                <Card key={order.id} className="bg-card/70 backdrop-blur-sm shadow-lg">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${statusInfo.color} animate-pulse`} />
                        <div>
                          <h3 className="font-semibold">
                            Order #{order.id.slice(-6).toUpperCase()}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {order.restaurant_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-primary">
                          ${order.total_usd.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(order.created_at)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Status Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        {statusInfo.icon}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{statusInfo.label}</span>
                            <Badge variant={statusInfo.variant}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {statusInfo.description}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-3">
                        <Progress value={statusInfo.progress} className="h-3" />
                        <div className="flex justify-between text-sm">
                          <span className={statusInfo.progress >= 25 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                            Received
                          </span>
                          <span className={statusInfo.progress >= 75 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                            Preparing
                          </span>
                          <span className={statusInfo.progress >= 100 ? 'text-primary font-medium' : 'text-muted-foreground'}>
                            Ready
                          </span>
                        </div>
                      </div>

                      {/* Estimated Time */}
                      {statusInfo.progress < 100 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                          <Clock className="h-4 w-4" />
                          <span>
                            Estimated time: {statusInfo.progress < 75 ? '15-20' : '5-10'} minutes
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Order Items */}
                    {items.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="font-medium">Order Items</h4>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg ${
                                item.is_available ? 'bg-muted/20' : 'bg-destructive/10 border border-destructive/20'
                              }`}>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={`font-medium ${!item.is_available ? 'line-through text-muted-foreground' : ''}`}>
                                      {item.quantity}x {item.menu_item_name}
                                    </p>
                                    {!item.is_available && (
                                      <Badge variant="destructive" className="text-xs">
                                        Unavailable
                                      </Badge>
                                    )}
                                  </div>
                                  {!item.is_available && (
                                    <p className="text-sm text-destructive mt-1">
                                      This item is no longer available. Staff will handle this.
                                    </p>
                                  )}
                                  {item.notes && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Note: {item.notes}
                                    </p>
                                  )}
                                </div>
                                <span className={`font-semibold ${item.is_available ? 'text-primary' : 'text-muted-foreground'}`}>
                                  ${(item.price_usd * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyOrders;
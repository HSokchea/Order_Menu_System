import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ChefHat, Clock, CheckCircle, Eye, X, ShoppingBag, Package2, ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveOrder {
  id: string;
  table_number: string;
  total_usd: number;
  status: string;
  created_at: string;
  restaurant_name: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_usd: number;
  menu_item_name: string;
  notes?: string;
}

interface OrderStatusTrackerProps {
  orders: ActiveOrder[];
  onViewDetails?: (orderId: string) => void;
}

const OrderStatusTracker = ({ orders, onViewDetails }: OrderStatusTrackerProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [showNoOrdersPrompt, setShowNoOrdersPrompt] = useState(false);

  // Show a small prompt if no active orders but user has been on this page for a while
  useEffect(() => {
    if (orders.length === 0) {
      const timer = setTimeout(() => {
        setShowNoOrdersPrompt(true);
      }, 3000); // Show after 3 seconds of browsing without orders
      
      return () => clearTimeout(timer);
    } else {
      setShowNoOrdersPrompt(false);
    }
  }, [orders.length]);

  // Show minimized prompt when no active orders but user has been browsing
  if (orders.length === 0) {
    if (showNoOrdersPrompt) {
      return (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="bg-card/95 backdrop-blur-md border shadow-lg hover:shadow-xl transition-all duration-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package2 className="h-4 w-4" />
                <span>No active orders</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNoOrdersPrompt(false)}
                  className="h-5 w-5 p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return null;
  }

  // Fetch order items for each order
  useEffect(() => {
    const fetchOrderItems = async () => {
      const itemsMap: Record<string, OrderItem[]> = {};
      
      for (const order of orders) {
        try {
          const { data: items, error } = await supabase
            .from('order_items')
            .select(`
              id,
              quantity,
              price_usd,
              notes,
              menu_items:menu_item_id (name)
            `)
            .eq('order_id', order.id);

          if (!error && items) {
            itemsMap[order.id] = items.map(item => ({
              id: item.id,
              quantity: item.quantity,
              price_usd: Number(item.price_usd || 0),
              menu_item_name: (item.menu_items as any)?.name || 'Unknown Item',
              notes: item.notes || undefined
            }));
          }
        } catch (error) {
          console.error('Error fetching order items:', error);
        }
      }
      
      setOrderItems(itemsMap);
    };

    if (orders.length > 0) {
      fetchOrderItems();
    }
  }, [orders]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'new':
        return {
          label: 'Order Received',
          icon: <Clock className="h-4 w-4" />,
          progress: 25,
          color: 'bg-blue-500',
          variant: 'secondary' as const
        };
      case 'preparing':
        return {
          label: 'Preparing',
          icon: <ChefHat className="h-4 w-4" />,
          progress: 75,
          color: 'bg-orange-500',
          variant: 'default' as const
        };
      case 'ready':
        return {
          label: 'Ready!',
          icon: <CheckCircle className="h-4 w-4" />,
          progress: 100,
          color: 'bg-green-500',
          variant: 'default' as const
        };
      default:
        return {
          label: 'Processing',
          icon: <Clock className="h-4 w-4" />,
          progress: 10,
          color: 'bg-gray-500',
          variant: 'secondary' as const
        };
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const latestOrder = orders[0]; // Most recent order first
  const statusInfo = getStatusInfo(latestOrder.status);

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="bg-card/95 backdrop-blur-md border shadow-lg hover:shadow-xl transition-all duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
              <div className={`w-3 h-3 rounded-full ${statusInfo.color} animate-pulse`} />
              <Package2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {orders.length} order{orders.length > 1 ? 's' : ''}
              </span>
              <Badge variant={statusInfo.variant} className="text-xs px-2 py-0">
                {statusInfo.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 pointer-events-none">
      <div className="container mx-auto max-w-lg pointer-events-auto">
        <Card className="bg-card/95 backdrop-blur-md border shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusInfo.color} animate-pulse`} />
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Your Orders</span>
                <Badge variant="secondary" className="text-xs">
                  {orders.length} active
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {orders.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-7 w-7 p-0"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  </Button>
                )}
                {onViewDetails && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(latestOrder.id)}
                    className="h-7 w-7 p-0"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0 space-y-4">
            {/* Latest Order - Always Visible */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Order #{latestOrder.id.slice(-6).toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-primary">
                  ${latestOrder.total_usd.toFixed(2)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusInfo.icon}
                  <span className="text-sm font-medium">{statusInfo.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTime(latestOrder.created_at)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={statusInfo.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className={statusInfo.progress >= 25 ? 'text-primary font-medium' : ''}>Received</span>
                  <span className={statusInfo.progress >= 75 ? 'text-primary font-medium' : ''}>Preparing</span>
                  <span className={statusInfo.progress >= 100 ? 'text-primary font-medium' : ''}>Ready</span>
                </div>
              </div>

              {/* Order Items */}
              {orderItems[latestOrder.id] && orderItems[latestOrder.id].length > 0 && (
                <div className="space-y-2">
                  <Separator />
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Items:</span>
                    {orderItems[latestOrder.id].slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="flex-1 text-foreground">
                          {item.quantity}x {item.menu_item_name}
                        </span>
                        <span className="text-muted-foreground">
                          ${(item.price_usd * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {orderItems[latestOrder.id].length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{orderItems[latestOrder.id].length - 3} more items
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Additional Orders - Show when expanded */}
            {isExpanded && orders.length > 1 && (
              <div className="space-y-3 pt-2 border-t">
                {orders.slice(1).map((order) => {
                  const orderStatusInfo = getStatusInfo(order.status);
                  return (
                    <div key={order.id} className="space-y-2 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Order #{order.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold">
                          ${order.total_usd.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${orderStatusInfo.color}`} />
                          <span className="text-xs">{orderStatusInfo.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(order.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Estimated Time */}
            {statusInfo.progress < 100 && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                <Clock className="h-3 w-3" />
                <span>Estimated time: {statusInfo.progress < 75 ? '15-20' : '5-10'} minutes</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderStatusTracker;
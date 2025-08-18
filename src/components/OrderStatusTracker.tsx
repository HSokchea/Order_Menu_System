import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChefHat, Clock, CheckCircle, Eye, X } from 'lucide-react';
import { useState } from 'react';

interface ActiveOrder {
  id: string;
  table_number: string;
  total_usd: number;
  status: string;
  created_at: string;
  restaurant_name: string;
}

interface OrderStatusTrackerProps {
  orders: ActiveOrder[];
  onViewDetails?: (orderId: string) => void;
}

const OrderStatusTracker = ({ orders, onViewDetails }: OrderStatusTrackerProps) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (orders.length === 0) return null;

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

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 pointer-events-none">
      <div className="container mx-auto max-w-md pointer-events-auto">
        <Card className="bg-card/95 backdrop-blur-md border shadow-lg">
          <CardContent className="p-4">
            {!isMinimized ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusInfo.color} animate-pulse`} />
                    <span className="font-semibold text-sm">Active Order</span>
                  </div>
                  <div className="flex items-center gap-1">
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

                {/* Order Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Order #{latestOrder.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold">
                      ${latestOrder.total_usd.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {statusInfo.icon}
                      <span className="text-sm">{statusInfo.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(latestOrder.created_at)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <Progress value={statusInfo.progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Received</span>
                      <span>Preparing</span>
                      <span>Ready</span>
                    </div>
                  </div>
                </div>

                {/* Multiple Orders Indicator */}
                {orders.length > 1 && (
                  <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                    + {orders.length - 1} more order{orders.length > 2 ? 's' : ''}
                  </div>
                )}
              </div>
            ) : (
              /* Minimized View */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${statusInfo.color} animate-pulse`} />
                  <span className="text-sm font-medium">
                    {orders.length} active order{orders.length > 1 ? 's' : ''}
                  </span>
                  <Badge variant={statusInfo.variant} className="text-xs px-2 py-0">
                    {statusInfo.label}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(false)}
                  className="h-7 w-7 p-0"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderStatusTracker;
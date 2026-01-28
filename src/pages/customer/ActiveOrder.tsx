import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, RefreshCw, Clock, ChefHat, CheckCircle2, Receipt, Utensils, ShoppingBag } from 'lucide-react';
import { useActiveOrder } from '@/hooks/useActiveOrder';
import { format } from 'date-fns';

const statusConfig = {
  placed: {
    label: 'Order Placed',
    description: 'Your order has been received',
    icon: Clock,
    color: 'bg-blue-500',
    badgeVariant: 'default' as const,
  },
  preparing: {
    label: 'Preparing',
    description: 'Your order is being prepared',
    icon: ChefHat,
    color: 'bg-orange-500',
    badgeVariant: 'secondary' as const,
  },
  ready: {
    label: 'Ready',
    description: 'Your order is ready for pickup',
    icon: CheckCircle2,
    color: 'bg-green-500',
    badgeVariant: 'default' as const,
  },
  completed: {
    label: 'Completed',
    description: 'Order has been completed',
    icon: CheckCircle2,
    color: 'bg-gray-500',
    badgeVariant: 'outline' as const,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Order was cancelled',
    icon: Clock,
    color: 'bg-red-500',
    badgeVariant: 'destructive' as const,
  },
};

const ActiveOrder = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table_id');

  const { order, shop, isLoading, error, refetch } = useActiveOrder(shopId);

  const menuUrl = tableId ? `/menu/${shopId}?table_id=${tableId}` : `/menu/${shopId}`;
  const billUrl = tableId ? `/menu/${shopId}/bill?table_id=${tableId}` : `/menu/${shopId}/bill`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-muted/20">
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link to={menuUrl}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold text-primary">Order Status</h1>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No Active Order</h2>
              <p className="text-muted-foreground mb-6">
                {error || "You don't have any active orders at the moment."}
              </p>
              <Button asChild>
                <Link to={menuUrl}>Browse Menu</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.placed;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link to={menuUrl}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-primary">Order Status</h1>
                {shop && <p className="text-sm text-muted-foreground">{shop.name}</p>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Order Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full ${status.color} flex items-center justify-center mb-4`}>
                <StatusIcon className="h-8 w-8 text-white" />
              </div>
              <Badge variant={status.badgeVariant} className="mb-2">
                {status.label}
              </Badge>
              <p className="text-muted-foreground">{status.description}</p>
              
              {/* Order Type & Table */}
              <div className="flex items-center gap-2 mt-4">
                {order.order_type === 'dine_in' ? (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Utensils className="h-4 w-4" />
                    <span>Dine In</span>
                    {order.table_number && <span>• Table {order.table_number}</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" />
                    <span>Takeaway</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Ordered at {format(new Date(order.created_at), 'h:mm a')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items.map((item, index) => {
                const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                const itemTotal = (item.price_usd + optionsTotal) * item.quantity;

                return (
                  <div key={item.id || index}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.quantity}×</span>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        {item.options && item.options.length > 0 && (
                          <div className="ml-6 mt-1">
                            {item.options.map((opt, idx) => (
                              <p key={idx} className="text-xs text-muted-foreground">
                                {opt.groupName}: {opt.label}
                                {opt.price !== 0 && (
                                  <span className={opt.price > 0 ? '' : 'text-green-600'}>
                                    {' '}({opt.price > 0 ? '+' : ''}${opt.price.toFixed(2)})
                                  </span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-medium">${itemTotal.toFixed(2)}</span>
                    </div>
                    {index < order.items.length - 1 && <Separator className="mt-3" />}
                  </div>
                );
              })}
            </div>

            {order.customer_notes && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="text-sm font-medium mb-1">Special Instructions</p>
                  <p className="text-sm text-muted-foreground">{order.customer_notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total & Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center text-lg font-semibold mb-4">
              <span>Total</span>
              <span>${order.total_usd.toFixed(2)}</span>
            </div>
            
            <div className="space-y-2">
              <Button variant="outline" className="w-full" asChild>
                <Link to={billUrl}>
                  <Receipt className="h-4 w-4 mr-2" />
                  View Bill
                </Link>
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link to={menuUrl}>
                  Order More Items
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ActiveOrder;

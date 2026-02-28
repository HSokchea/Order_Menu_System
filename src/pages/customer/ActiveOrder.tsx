import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, RefreshCw, Clock, ChefHat, CheckCircle2, Receipt, Utensils, ShoppingBag, XCircle } from 'lucide-react';
import { useActiveOrder } from '@/hooks/useActiveOrder';
import { groupOrderItems, calculateOrderTotal, groupItemsIntoRounds, groupRoundItems } from '@/types/order';
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
  paid: {
    label: 'Paid',
    description: 'Order has been paid',
    icon: CheckCircle2,
    color: 'bg-gray-500',
    badgeVariant: 'outline' as const,
  },
};

const itemStatusColors: Record<string, string> = {
  pending: 'text-muted-foreground',
  preparing: 'text-orange-600',
  ready: 'text-green-600',
  rejected: 'text-red-500 line-through',
};

const itemStatusBadges: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  preparing: { label: 'Preparing', variant: 'default' },
  ready: { label: 'Ready', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
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
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md py-1">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between relative">

              {/* Left section */}
              <div className="flex items-center flex-1 gap-2">
                <Button variant="ghost" className="rounded-full w-8 h-8" asChild>
                  <Link to={menuUrl}>
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>

                {/* Title + shop (inline on lg+) */}
                <div className="hidden lg:block">
                  <h4 className="text-lg font-bold text-secondary-foreground">
                    Order Status
                  </h4>
                </div>
              </div>

              {/* Center title (mobile/tablet) */}
              <div className="lg:hidden absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
                <h4 className="text-lg font-bold text-secondary-foreground">
                  Order Status
                </h4>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="text-center py-12">
              <Clock className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No Active Order</h2>
              <p className="text-muted-foreground mb-2">You don't have any active orders at the moment.</p>
              <Button variant='secondary' asChild size='custom' className='rounded-full px-3 py-2'>
                <Link to={menuUrl}>Back to Menu</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.placed;
  const StatusIcon = status.icon;

  // Group items into rounds for special requests display
  const rounds = groupItemsIntoRounds(order.items);

  // Group items for display
  const groupedItems = groupOrderItems(order.items);
  const total = calculateOrderTotal(order.items);

   // Generate order short ID from last 4 digits of created_at timestamp
  const match = order.created_at.match(/\.(\d+)/);
  const shortId = `#${match[1].slice(-4)}`;

  // Group by item status for visual sections
  const pendingItems = groupedItems.filter(g => g.status === 'pending');
  const preparingItems = groupedItems.filter(g => g.status === 'preparing');
  const readyItems = groupedItems.filter(g => g.status === 'ready');
  const rejectedItems = groupedItems.filter(g => g.status === 'rejected');

  // Collect all special requests from rounds
  const specialRequests = rounds
    .filter(r => r.specialRequest)
    .map(r => ({ roundNumber: r.roundNumber, note: r.specialRequest! }));

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md py-1">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between relative">

            {/* Left section */}
            <div className="flex items-center flex-1 gap-2">
              <Button variant="ghost" className="rounded-full w-8 h-8" asChild>
                <Link to={menuUrl}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>

              {/* Title + shop (inline on lg+) */}
              <div className="hidden lg:block">
                <h4 className="text-lg font-bold text-secondary-foreground">
                  Order Status
                </h4>
              </div>
            </div>

            {/* Center title (mobile/tablet) */}
            <div className="lg:hidden absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <h4 className="text-lg font-bold text-secondary-foreground">
                Order Status
              </h4>
            </div>

            {/* Right section */}
            <div className="flex items-center justify-end flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={refetch}
                className="rounded-full w-8 h-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
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
                    <span>• Order {shortId}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" />
                    <span>Takeaway</span>
                    <span>• Order {shortId}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Ordered at {format(new Date(order.created_at), 'h:mm a')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order Items - Grouped by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Ready Items */}
              {readyItems.length > 0 && (
                <ItemSection
                  title="Ready"
                  icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
                  items={readyItems}
                  statusClass="text-green-600"
                />
              )}

              {/* Preparing Items */}
              {preparingItems.length > 0 && (
                <ItemSection
                  title="Preparing"
                  icon={<ChefHat className="h-4 w-4 text-orange-600" />}
                  items={preparingItems}
                  statusClass="text-orange-600"
                />
              )}

              {/* Pending Items */}
              {pendingItems.length > 0 && (
                <ItemSection
                  title="Pending"
                  icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  items={pendingItems}
                  statusClass="text-muted-foreground"
                />
              )}

              {/* Rejected Items - with strikethrough */}
              {rejectedItems.length > 0 && (
                <ItemSection
                  title="Rejected"
                  icon={<XCircle className="h-4 w-4 text-red-500" />}
                  items={rejectedItems}
                  statusClass="text-red-500 line-through"
                  isRejected
                />
              )}
            </div>

            {/* Special Requests per Round */}
            {specialRequests.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Special Instructions</p>
                  {specialRequests.map((req) => (
                    <div key={req.roundNumber} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Round {req.roundNumber}
                      </p>
                      <p className="text-sm text-muted-foreground italic">"{req.note}"</p>
                    </div>
                  ))}
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
              <span>${total.toFixed(2)}</span>
            </div>
            {rejectedItems.length > 0 && (
              <p className="text-xs text-muted-foreground mb-4 text-center">
                * Total excludes rejected items
              </p>
            )}

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

// Item Section Component
interface ItemSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ReturnType<typeof groupOrderItems>;
  statusClass: string;
  isRejected?: boolean;
}

const ItemSection = ({ title, icon, items, statusClass, isRejected }: ItemSectionProps) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm font-medium">
      {icon}
      <span>{title}</span>
      <Badge variant="outline" className="text-xs">{items.reduce((sum, i) => sum + i.count, 0)}</Badge>
    </div>
    <div className="pl-6 space-y-2">
      {items.map((item, index) => {
        const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
        const itemTotal = (item.price + optionsTotal) * item.count;

        return (
          <div key={index} className={`flex justify-between items-start ${isRejected ? 'opacity-60' : ''}`}>
            <div className="flex-1">
              <div className={`flex items-center gap-2 ${statusClass}`}>
                <span className="font-medium">{item.count}×</span>
                <span className={isRejected ? 'line-through' : ''}>{item.name}</span>
              </div>
              {item.options && item.options.length > 0 && (
                <div className="ml-6 mt-1">
                  {item.options.map((opt, idx) => (
                    <p key={idx} className={`text-xs ${isRejected ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                      {opt.groupName}: {opt.label}
                      {opt.price !== 0 && (
                        <span>
                          {' '}({opt.price > 0 ? '+' : ''}${opt.price.toFixed(2)})
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <span className={`font-medium ${isRejected ? 'line-through opacity-60' : ''}`}>
              ${itemTotal.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

export default ActiveOrder;
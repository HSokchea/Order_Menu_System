import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Receipt, Utensils, ShoppingBag } from 'lucide-react';
import { useActiveOrder } from '@/hooks/useActiveOrder';
import { groupOrderItems, calculateOrderTotal, groupItemsIntoRounds } from '@/types/order';
import { format } from 'date-fns';

const Bill = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table_id');

  const { order, shop, isLoading, error } = useActiveOrder(shopId);

  const menuUrl = tableId ? `/menu/${shopId}?table_id=${tableId}` : `/menu/${shopId}`;
  const orderUrl = tableId ? `/menu/${shopId}/order?table_id=${tableId}` : `/menu/${shopId}/order`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-muted/20">
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md py-1">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between relative">
              {/* Left section - Back button */}
              <div className="flex items-center flex-1">
                <Button variant="ghost" className='rounded-full w-8 h-8 mr-2'>
                  <Link to={menuUrl}>
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>

                {/* Title inline on lg+ screens */}
                <h4 className="hidden lg:block text-lg font-bold text-secondary-foreground">Bill</h4>
              </div>

              {/* Title centered absolutely on mobile/tablet */}
              <h4 className="lg:hidden absolute left-1/2 -translate-x-1/2 text-lg font-bold text-secondary-foreground pointer-events-none">
                Bill
              </h4>

              {/* Right section - Empty for spacing */}
              <div className="flex-1"></div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="text-center py-12">
              <Receipt className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No Bill Available</h2>
              <p className="text-muted-foreground mb-2">Place an order to view your bill.</p>
              <Button variant='secondary' asChild size='custom' className='rounded-full px-3 py-2'>
                <Link to={menuUrl}>Back to Menu</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Group items for display and calculate total (excluding rejected)
  const groupedItems = groupOrderItems(order.items);
  const activeItems = groupedItems.filter(g => g.status !== 'rejected');
  const rejectedItems = groupedItems.filter(g => g.status === 'rejected');
  const subtotal = calculateOrderTotal(order.items);

  // Get special requests per round
  const rounds = groupItemsIntoRounds(order.items);
  const specialRequests = rounds
    .filter(r => r.specialRequest)
    .map(r => ({ roundNumber: r.roundNumber, note: r.specialRequest! }));

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="rounded-full w-8 h-8" asChild>
              <Link to={orderUrl}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-secondary-foreground">Bill</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Receipt Style Card */}
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center border-b pb-4">
            {shop && (
              <div className="mb-2">
                <h2 className="text-xl font-bold">{shop.name}</h2>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at), 'MMMM d, yyyy • h:mm a')}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              {order.order_type === 'dine_in' ? (
                <div className="flex items-center gap-1 text-sm">
                  <Utensils className="h-4 w-4" />
                  <span>Dine In</span>
                  {order.table_number && <span>• Table {order.table_number}</span>}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-sm">
                  <ShoppingBag className="h-4 w-4" />
                  <span>Takeaway</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {/* Active Items */}
            <div className="space-y-3">
              {activeItems.map((item, index) => {
                const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                const itemTotal = (item.price + optionsTotal) * item.count;

                return (
                  <div key={index} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span>{item.count} × {item.name}</span>
                      {item.options && item.options.length > 0 && (
                        <div className="text-xs text-muted-foreground ml-4">
                          {item.options.map((opt, idx) => (
                            <span key={idx}>
                              {opt.label}
                              {idx < item.options!.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span>${itemTotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            {/* Rejected Items (struck through) */}
            {rejectedItems.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2 opacity-60">
                  <p className="text-xs text-muted-foreground">Rejected Items:</p>
                  {rejectedItems.map((item, index) => {
                    const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                    const itemTotal = (item.price + optionsTotal) * item.count;

                    return (
                      <div key={index} className="flex justify-between text-sm line-through text-muted-foreground">
                        <span>{item.count} × {item.name}</span>
                        <span>${itemTotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <Separator className="my-4" />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              {/* Future: Tax, Service Charge, etc. can be added here */}

              <Separator className="my-2" />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              <p className="text-xs text-center text-muted-foreground mt-2">
                {shop?.currency || 'USD'}
              </p>
            </div>

            {/* Special Requests per Round */}
            {specialRequests.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="text-sm space-y-2">
                  <p className="font-medium">Notes</p>
                  {specialRequests.map((req) => (
                    <div key={req.roundNumber} className="bg-muted/50 rounded p-2">
                      <p className="text-xs font-medium text-muted-foreground">Round {req.roundNumber}</p>
                      <p className="text-muted-foreground italic">"{req.note}"</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Separator className="my-4" />

            <p className="text-center text-sm text-muted-foreground">
              Thank you for your order!
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="max-w-md mx-auto mt-4 space-y-2">
          <Button variant="outline" className="w-full" asChild>
            <Link to={orderUrl}>Back to Order Status</Link>
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link to={menuUrl}>Order More Items</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Bill;
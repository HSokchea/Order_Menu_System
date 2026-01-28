import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Receipt, Utensils, ShoppingBag } from 'lucide-react';
import { useActiveOrder } from '@/hooks/useActiveOrder';
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
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link to={menuUrl}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold text-primary">Bill</h1>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No Bill Available</h2>
              <p className="text-muted-foreground mb-6">
                {error || "Place an order to view your bill."}
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

  // Calculate totals
  const subtotal = order.total_usd;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to={orderUrl}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary">Bill</h1>
              {shop && <p className="text-sm text-muted-foreground">{shop.name}</p>}
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
            {/* Items */}
            <div className="space-y-3">
              {order.items.map((item, index) => {
                const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                const itemTotal = (item.price_usd + optionsTotal) * item.quantity;

                return (
                  <div key={item.id || index} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span>{item.quantity} × {item.name}</span>
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

            {order.customer_notes && (
              <>
                <Separator className="my-4" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Notes</p>
                  <p className="text-muted-foreground">{order.customer_notes}</p>
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

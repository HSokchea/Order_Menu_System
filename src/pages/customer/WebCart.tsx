import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingCart, Trash2, CreditCard, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDeviceOrder } from '@/hooks/useDeviceOrder';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const WebCart = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table_id");
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const {
    order,
    isLoading,
    updateItemQuantity,
    removeItem,
    clearOrder,
    updateNotes,
    completePayment,
  } = useDeviceOrder(shopId, tableId);

  const handleUpdateQuantity = async (menuItemId: string, newQuantity: number) => {
    try {
      await updateItemQuantity(menuItemId, newQuantity);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update quantity');
    }
  };

  const handleRemoveItem = async (menuItemId: string) => {
    try {
      await removeItem(menuItemId);
      toast.success('Item removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove item');
    }
  };

  const handleUpdateNotes = async () => {
    try {
      await updateNotes(notes);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update notes');
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Update notes before payment
      if (notes) {
        await updateNotes(notes);
      }

      const result = await completePayment();

      if (result.success) {
        setPaymentComplete(true);
        toast.success('Payment completed successfully!');

        // Wait a moment to show success state, then redirect
        setTimeout(() => {
          setShowPaymentDialog(false);
          // navigate(`/menu/${shopId}`);
          navigate(  
            tableId
                    ? `/menu/${shopId}?table_id=${tableId}`
                    : `/menu/${shopId}`
          )
        }, 2000);
      } else {
        toast.error(result.error || 'Payment failed');
        setShowPaymentDialog(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
      setShowPaymentDialog(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild className="mr-2">
                <Link to={`/menu/${shopId}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-primary">Your Order</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!order || order.items.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-4">Add some items from the menu</p>
              <Button asChild>
                <Link
                  to={
                    tableId
                      ? `/menu/${shopId}?table_id=${tableId}`
                      : `/menu/${shopId}`
                  }
                >
                  Browse Menu
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="pt-0">
                <CardTitle className="text-lg font-semibold">Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item) => {
                    const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                    const itemTotal = (item.price_usd + optionsTotal) * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold">{item.name}</h3>

                            {/* Selected Options */}
                            {item.options && item.options.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {item.options.map((opt, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    {opt.groupName}: {opt.label}
                                    {opt.price !== 0 && (
                                      <span className={opt.price > 0 ? '' : 'text-green-600'}>
                                        {' '}({opt.price > 0 ? '+' : ''}{opt.price.toFixed(2)})
                                      </span>
                                    )}
                                  </p>
                                ))}
                              </div>
                            )}

                            <p className="text-sm text-muted-foreground mt-1">
                              ${(item.price_usd + optionsTotal).toFixed(2)} each
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-white rounded-full border border-input bg-background px-2 py-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateQuantity(item.menu_item_id, item.quantity - 1)}
                                className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="text-sm font-semibold min-w-[20px] text-center">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateQuantity(item.menu_item_id, item.quantity + 1)}
                                className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveItem(item.menu_item_id)}
                              className="h-9 w-9 p-3 rounded-full text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-right mt-2">
                          <span className="font-semibold">${itemTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="pt-0">
                <CardTitle className="text-lg font-semibold">Special Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special requests or allergies..."
                  value={notes}
                  onChange={(e) => {
                    const plainText = e.target.value.replace(/<[^>]*>/g, '');
                    if (plainText.length <= 500) {
                      setNotes(plainText);
                    }
                  }}
                  onBlur={handleUpdateNotes}
                  className="mt-2 resize-none"
                  rows={3}
                  maxLength={500}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${notes.length >= 450 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {notes.length} / 500
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="px-4 border-none shadow-none p-0 bg-transparent">
              <CardContent className="p-6">
                <div className="flex justify-between items-center text-lg font-semibold mb-4">
                  <span>Total</span>
                  <span>${order.total_usd.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowPaymentDialog(true)}
                  disabled={isProcessing}
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  Proceed to Payment
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <AlertDialogContent>
          {!paymentComplete ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to complete your order for ${order?.total_usd.toFixed(2)}.
                  <br /><br />
                  Once paid, this order cannot be modified.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePayment} disabled={isProcessing}>
                  {isProcessing ? 'Processing...' : 'Confirm Payment'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
              <p className="text-muted-foreground">Thank you for your order.</p>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WebCart;

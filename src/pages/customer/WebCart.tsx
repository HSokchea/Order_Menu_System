import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingCart, Trash2, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalCart } from '@/hooks/useLocalCart';
import { useDeviceId } from '@/hooks/useDeviceId';
import { supabase } from '@/integrations/supabase/client';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Use LOCAL cart - no backend calls until Place Order
  const {
    items,
    notes,
    total,
    isLoaded,
    updateItemQuantity,
    removeItem,
    updateNotes,
    clearCart,
  } = useLocalCart(shopId, tableId);

  const { deviceId, isLoaded: deviceIdLoaded } = useDeviceId();

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
    } else {
      updateItemQuantity(itemId, newQuantity);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
    toast.success('Item removed');
  };

  // SINGLE COMMIT POINT: Create order only when Place Order is clicked
  const handlePlaceOrder = async () => {
    if (!shopId || !deviceId) {
      toast.error('Unable to place order. Please try again.');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create the order in tb_order_temporary
      const orderItems = items.map(item => ({
        menu_item_id: item.menu_item_id,
        name: item.name,
        quantity: item.quantity,
        price_usd: item.price_usd,
        options: item.options || [],
      }));

      const { data: createData, error: createError } = await supabase.rpc('get_or_create_device_order', {
        p_shop_id: shopId,
        p_device_id: deviceId,
        p_table_id: tableId || undefined,
      });

      if (createError) {
        throw new Error(createError.message);
      }

      const response = createData as { exists: boolean; order: { id: string } };
      const orderId = response.order.id;

      // Step 2: Update the order with items and notes
      const { error: updateError } = await supabase.rpc('update_device_order', {
        p_order_id: orderId,
        p_device_id: deviceId,
        p_items: orderItems as any,
        p_total_usd: total,
        p_customer_notes: notes || null,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Step 3: Place the order (moves to history with status='placed')
      const { data: placeData, error: placeError } = await supabase.rpc('place_device_order', {
        p_order_id: orderId,
        p_device_id: deviceId,
      });

      if (placeError) {
        throw new Error(placeError.message);
      }

      const placeResponse = placeData as { success: boolean; error?: string };
      
      if (!placeResponse.success) {
        throw new Error(placeResponse.error || 'Failed to place order');
      }

      // Success! Clear local cart and redirect
      setOrderPlaced(true);
      clearCart();
      toast.success('Order placed successfully!');

      // Wait a moment to show success state, then redirect to active order page
      setTimeout(() => {
        setShowConfirmDialog(false);
        navigate(
          tableId
            ? `/menu/${shopId}/order?table_id=${tableId}`
            : `/menu/${shopId}/order`
        );
      }, 1500);
    } catch (err: any) {
      console.error('Place order error:', err);
      toast.error(err.message || 'Failed to place order');
      setShowConfirmDialog(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoaded || !deviceIdLoaded) {
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
                <Link to={tableId ? `/menu/${shopId}?table_id=${tableId}` : `/menu/${shopId}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-primary">Your Cart</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {items.length === 0 ? (
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
                <CardTitle className="text-lg font-semibold">Cart Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item) => {
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
                                onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
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
                                onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveItem(item.id)}
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
                      updateNotes(plainText);
                    }
                  }}
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
                  <span>${total.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isProcessing || items.length === 0}
                >
                  <Send className="h-5 w-5 mr-2" />
                  Place Order
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Order Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          {!orderPlaced ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Order</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to place your order for ${total.toFixed(2)}.
                  <br /><br />
                  Once placed, your order will be sent to the kitchen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePlaceOrder} disabled={isProcessing}>
                  {isProcessing ? 'Placing Order...' : 'Confirm Order'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Order Placed!</h2>
              <p className="text-muted-foreground">Redirecting to your order status...</p>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WebCart;

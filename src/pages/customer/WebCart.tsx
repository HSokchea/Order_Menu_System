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
  console.log('Cart items:', items);
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

      // Step 3: Place the order via secure edge function (validates WiFi IP)
      const { data: placeData, error: placeError } = await supabase.functions.invoke('place-order-secure', {
        body: {
          order_id: orderId,
          device_id: deviceId,
          shop_id: shopId,
        },
      });

      if (placeError) {
        throw new Error(placeError.message);
      }

      const placeResponse = placeData as { success: boolean; error?: string; reason?: string };

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
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md py-1">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between relative">
            {/* Left section - Back button */}
            <div className="flex items-center flex-1">
              <Button variant="ghost" className='rounded-full w-8 h-8 mr-2'>
                <Link to={tableId ? `/menu/${shopId}?table_id=${tableId}` : `/menu/${shopId}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>

              {/* Title inline on lg+ screens */}
              <h4 className="hidden lg:block text-lg font-bold text-secondary-foreground">Your Cart</h4>
            </div>

            {/* Title centered absolutely on mobile/tablet */}
            <h4 className="lg:hidden absolute left-1/2 -translate-x-1/2 text-lg font-bold text-secondary-foreground pointer-events-none">
              Your Cart
            </h4>

            {/* Right section - Empty for spacing */}
            <div className="flex-1"></div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-0 md:px-4 lg:px-8 py-6">
        {items.length === 0 ? (
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="text-center py-12">
              <ShoppingCart className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No Items Available</h2>
              <p className="text-muted-foreground mb-2">Place an order to view your items.</p>
              <Button variant='secondary' asChild size='custom' className='rounded-full px-3 py-2'>
                <Link
                  to={
                    tableId
                      ? `/menu/${shopId}?table_id=${tableId}`
                      : `/menu/${shopId}`
                  }
                >
                  Back to Menu
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4 items-start">

            {/* Left Column — Items */}
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="py-0 pb-3">
                <CardTitle className="text-lg font-semibold">Item</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => {
                    const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                    const itemTotal = (item.price_usd + optionsTotal) * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-white border border-muted shadow-sm"
                      >
                        <div className="flex gap-3">

                          {/* Image */}
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-20 h-20 object-cover rounded-xl shrink-0"
                          />

                          {/* Middle Content */}
                          <div className="flex-1 min-w-0">

                            {/* Top Row */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h6 className="font-medium text-sm">{item.name}</h6>
                                <p className="text-xs text-secondary-foreground/90 font-medium">
                                  ${(item.price_usd + optionsTotal).toFixed(2)}
                                </p>
                              </div>

                              {/* Delete */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveItem(item.id)}
                                className="h-8 w-8 p-0 rounded-full text-muted-foreground"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Options */}
                            {item.options && item.options.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {item.options.map((opt, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    {opt.groupName}: {opt.label}
                                    {opt.price !== 0 && (
                                      <span className={opt.price > 0 ? '' : 'text-green-600'}>
                                        {' '}
                                        ({opt.price > 0 ? '+' : ''}
                                        {opt.price.toFixed(2)})
                                      </span>
                                    )}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Quantity */}
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-3 bg-muted rounded-full px-1 py-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                  className="h-6 w-6 p-0 rounded-full hover:bg-muted-foreground/10"
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
                                  className="h-6 w-6 p-0 rounded-full bg-transparent hover:bg-muted-foreground/10"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Item Total */}
                              <span className="font-medium text-sm">
                                ${itemTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Note — not sticky, scrolls with page on sm/md */}
            <Card className="border-none shadow-none bg-transparent lg:hidden">
              <CardHeader className="py-0 pb-3">
                <CardTitle className="text-lg font-semibold">Note</CardTitle>
              </CardHeader>
              <CardContent>
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
                  className="resize bg-white border border-muted shadow-sm rounded-2xl"
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

            {/* Right Column — sticky bottom on sm/md, sticky top on lg */}
            <div className="
  flex flex-col gap-4
  fixed bottom-0 left-0 right-0 z-50 bg-background p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]
  lg:static lg:z-auto lg:bg-transparent lg:p-0 lg:shadow-none
  lg:sticky lg:top-20 lg:self-start
">
              {/* Note — only visible on lg inside the right column */}
              <Card className="border-none shadow-none bg-transparent hidden lg:block">
                <CardHeader className="py-0 pb-3">
                  <CardTitle className="text-lg font-semibold">Note</CardTitle>
                </CardHeader>
                <CardContent>
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
                    className="resize-none bg-white border border-muted shadow-sm rounded-2xl"
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

              {/* Total + Place Order — always visible */}
              <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0 lg:p-6">
                  <div className="flex justify-between items-center text-sm font-semibold mb-4">
                    <span>Total</span>
                    <span className="font-semibold text-sm text-primary">${total.toFixed(2)}</span>
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

            {/* Spacer so items aren't hidden behind fixed bottom bar on sm/md */}
            <div className="h-24 lg:hidden" />
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

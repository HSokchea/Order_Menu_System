import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, Trash2, Send, CheckCircle, MessageSquare } from 'lucide-react';
import StickyHeader from '@/components/customer/StickyHeader';
import { toast } from 'sonner';
import { useLocalCart } from '@/hooks/useLocalCart';
import { useDeviceId } from '@/hooks/useDeviceId';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

const WebCart = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table_id");
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

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

  const menuUrl = tableId ? `/menu/${shopId}?table_id=${tableId}` : `/menu/${shopId}`;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      toast.success('Item removed');
    } else {
      updateItemQuantity(itemId, newQuantity);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
    toast.success('Item removed');
  };

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

      if (createError) throw new Error(createError.message);

      const response = createData as { exists: boolean; order: { id: string } };
      const orderId = response.order.id;

      const { error: updateError } = await supabase.rpc('update_device_order', {
        p_order_id: orderId,
        p_device_id: deviceId,
        p_items: orderItems as any,
        p_total_usd: total,
        p_customer_notes: notes || null,
      });

      if (updateError) throw new Error(updateError.message);

      const { data: placeData, error: placeError } = await supabase.functions.invoke('place-order-secure', {
        body: { order_id: orderId, device_id: deviceId, shop_id: shopId },
      });

      if (placeError) throw new Error(placeError.message);

      const placeResponse = placeData as { success: boolean; error?: string };
      if (!placeResponse.success) throw new Error(placeResponse.error || 'Failed to place order');

      setOrderPlaced(true);
      clearCart();
      toast.success('Order placed successfully!');

      setTimeout(() => {
        setShowConfirmDialog(false);
        navigate(tableId ? `/menu/${shopId}/order?table_id=${tableId}` : `/menu/${shopId}/order`);
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
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 pt-16 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-0">
      <StickyHeader backUrl={menuUrl} title="Your Cart" />

      <main className="mx-auto max-w-2xl lg:max-w-5xl px-4 py-5 space-y-4">
        {items.length === 0 ? (
          /* ── Empty State ── */
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Your Cart is Empty</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Add items from the menu to get started.</p>
            <Button asChild className="rounded-full px-6">
              <Link to={menuUrl}>Browse Menu</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:gap-8">
            {/* ── Left: Cart Items ── */}
            <div className="flex-1 space-y-4">
              {/* Items header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Items ({totalItems})
                </h2>
              </div>

              {/* Item list */}
              <div className="space-y-2">
                {items.map((item) => {
                  const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                  const itemTotal = (item.price_usd + optionsTotal) * item.quantity;

                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 py-3 px-3 rounded-2xl bg-muted/20"
                    >
                      {/* Image */}
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-xl shrink-0"
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Name + delete */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ${(item.price_usd + optionsTotal).toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Options */}
                        {item.options && item.options.length > 0 && (
                          <div className="mt-1">
                            {item.options.map((opt, idx) => (
                              <p key={idx} className="text-[11px] text-muted-foreground">
                                {opt.groupName}: {opt.label}
                                {opt.price !== 0 && (
                                  <span className={opt.price > 0 ? '' : 'text-success'}>
                                    {' '}({opt.price > 0 ? '+' : ''}${opt.price.toFixed(2)})
                                  </span>
                                )}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Quantity + total */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-0 bg-muted rounded-full">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted-foreground/10 transition-colors"
                            >
                              <Minus className="h-3 w-3 text-foreground" />
                            </button>
                            <span className="text-xs font-semibold min-w-[24px] text-center text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted-foreground/10 transition-colors"
                            >
                              <Plus className="h-3 w-3 text-foreground" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            ${itemTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Notes Section (mobile/tablet) ── */}
              <div className="lg:hidden space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Note</h3>
                </div>
                <Textarea
                  placeholder="Any special requests or allergies..."
                  value={notes}
                  onChange={(e) => {
                    const plainText = e.target.value.replace(/<[^>]*>/g, '');
                    if (plainText.length <= 200) updateNotes(plainText);
                  }}
                  className="resize-none bg-muted/20 border-none rounded-xl text-sm min-h-[80px]"
                  rows={3}
                  maxLength={200}
                />
                <div className="flex justify-end">
                  <span className={cn(
                    'text-[11px]',
                    notes.length >= 180 ? 'text-destructive' : 'text-muted-foreground',
                  )}>
                    {notes.length}/200
                  </span>
                </div>
              </div>
            </div>

            {/* ── Right: Summary (large screen) ── */}
            <div className="hidden lg:block w-72 shrink-0">
              <div className="sticky top-20 rounded-2xl bg-muted/20 p-5 space-y-4 shadow-xs">
                <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>

                {/* Notes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Note</span>
                  </div>
                  <Textarea
                    placeholder="Any special requests or allergies..."
                    value={notes}
                    onChange={(e) => {
                      const plainText = e.target.value.replace(/<[^>]*>/g, '');
                      if (plainText.length <= 200) updateNotes(plainText);
                    }}
                    className="resize-none bg-background/60 border-none rounded-xl text-sm min-h-[80px]"
                    rows={3}
                    maxLength={200}
                  />
                  <div className="flex justify-end">
                    <span className={cn(
                      'text-[11px]',
                      notes.length >= 180 ? 'text-destructive' : 'text-muted-foreground',
                    )}>
                      {notes.length}/200
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-sm text-muted-foreground">Total ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
                  <span className="text-lg font-semibold text-foreground">${total.toFixed(2)}</span>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full rounded-xl"
                    size="sm"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={isProcessing || items.length === 0}
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    Place Order
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full rounded-xl bg-muted" asChild>
                    <Link to={menuUrl}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add More Items
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Sticky Bottom Bar (mobile only) ── */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg lg:hidden">
          <div className="mx-auto max-w-2xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
              <span className="text-lg font-semibold text-foreground">${total.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="sm" className="flex-1 rounded-xl bg-muted" asChild>
                <Link to={menuUrl}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add More
                </Link>
              </Button>
              <Button
                className="flex-1 rounded-xl"
                size="sm"
                onClick={() => setShowConfirmDialog(true)}
                disabled={isProcessing || items.length === 0}
              >
                <Send className="h-4 w-4 mr-1.5" />
                Place Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Dialog ── */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={orderPlaced ? "Order Placed!" : "Confirm Order"}
        description={
          orderPlaced
            ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Order Placed!</h2>
                <p className="text-muted-foreground">Redirecting to your order status...</p>
              </div>
            )
            : (
              <>
                You are about to place your order for ${total.toFixed(2)}. <br />
                Once placed, your order will be sent to the kitchen.
              </>
            )
        }
        confirmLabel={orderPlaced ? undefined : (isProcessing ? 'Placing Order...' : 'Confirm Order')}
        cancelLabel={orderPlaced ? undefined : 'Cancel'}
        variant={orderPlaced ? 'success' : 'default'}
        onConfirm={orderPlaced ? undefined : handlePlaceOrder}
        confirmDisabled={isProcessing || orderPlaced}
        cancelDisabled={isProcessing || orderPlaced}
      />
    </div>
  );
};

export default WebCart;

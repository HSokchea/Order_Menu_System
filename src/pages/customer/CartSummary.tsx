import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingCart, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/hooks/useCart';

interface UnavailableItem {
  id: string;
  name: string;
  reason: string;
}

interface OrderResponse {
  success: boolean;
  order_id?: string;
  order_token?: string;
  status?: string;
  unavailable_items?: UnavailableItem[];
}

const CartSummary = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [table, setTable] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<UnavailableItem[]>([]);

  const {
    cart,
    isLoaded: cartLoaded,
    updateCartItem,
    removeCartItem,
    clearCart,
    getTotalAmount,
    markItemsWithValidationErrors,
    clearValidationErrors,
    removeUnavailableItems,
  } = useCart(tableId);

  useEffect(() => {
    const fetchTableData = async () => {
      if (!tableId) return;

      // Use secure RPC functions to fetch table and restaurant data (works for anonymous users)
      const { data: tableResult, error: tableError } = await supabase
        .rpc('get_public_table', { p_table_id: tableId });

      const tableData = tableResult?.[0] || null;

      if (tableError || !tableData) {
        console.error('Table fetch error:', tableError);
        return;
      }

      setTable(tableData);

      // Fetch restaurant using secure RPC
      const { data: restaurantResult, error: restaurantError } = await supabase
        .rpc('get_public_restaurant', { p_restaurant_id: tableData.restaurant_id });

      const restaurantData = restaurantResult?.[0] || null;

      if (restaurantError || !restaurantData) {
        console.error('Restaurant fetch error:', restaurantError);
        return;
      }

      setRestaurant(restaurantData);
    };

    fetchTableData();
  }, [tableId]);

  const handleRemoveUnavailableItems = () => {
    const validationErrorIds = validationErrors.map(error => error.id);
    removeUnavailableItems(validationErrorIds);
    setValidationErrors([]);
  };

  const hasValidationErrors = () => validationErrors.length > 0;

  const placeOrder = async () => {
    if (cart.length === 0) return;

    clearValidationErrors();
    setLoading(true);

    try {
      const totalAmount = getTotalAmount();

      // Rule 7: Store complete price snapshot with order item
      const orderItemsPayload = cart.map((item) => {
        // Build price snapshot data for order item notes (JSON format)
        const priceSnapshot = {
          basePrice: item.basePrice,
          selectedOptions: item.selectedOptions?.map(o => ({
            group: o.groupName,
            value: o.label,
            price: o.price,
          })) || [],
          optionsTotal: item.optionsTotal,
          finalUnitPrice: item.finalUnitPrice,
          quantity: item.quantity,
          totalItemPrice: item.finalUnitPrice * item.quantity,
        };

        return {
          menu_item_id: item.id,
          quantity: item.quantity,
          price_usd: item.finalUnitPrice, // Store final unit price (base + options)
          notes: JSON.stringify(priceSnapshot), // Store complete price snapshot as JSON
        };
      });

      const { data: response, error: rpcError } = await supabase.rpc(
        'create_order_with_items_validated',
        {
          p_restaurant_id: restaurant.id,
          p_table_id: tableId,
          p_table_number: table.table_number,
          p_total_usd: totalAmount,
          p_customer_notes: notes || null,
          p_items: orderItemsPayload as any,
        }
      );

      if (rpcError) throw rpcError;
      if (!response) throw new Error('No response from server.');

      const orderResponse = response as any as OrderResponse;

      if (!orderResponse.success) {
        const unavailableItems = orderResponse.unavailable_items || [];
        setValidationErrors(unavailableItems);
        markItemsWithValidationErrors(unavailableItems);

        const errorMessages = unavailableItems.map(item => `${item.name}: ${item.reason}`);
        toast({
          title: "Order Cannot Be Placed",
          description: `Some items are no longer available:\n${errorMessages.join('\n')}`,
          variant: "destructive",
        });
        return;
      }

      if (orderResponse.order_id && orderResponse.order_token) {
        const storedTokens = JSON.parse(localStorage.getItem('order_tokens') || '{}');
        storedTokens[orderResponse.order_id] = orderResponse.order_token;
        localStorage.setItem('order_tokens', JSON.stringify(storedTokens));
      }

      clearCart();

      toast({
        title: "Order Placed Successfully!",
        description: "Your order has been sent to the kitchen.",
      });

      navigate(`/order-success/${orderResponse.order_id}?token=${orderResponse.order_token}`);
    } catch (error: any) {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!table || !restaurant) {
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
                <Link to={`/menu/${tableId}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-primary">Order Summary</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {cart.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-4">Add some items from the menu</p>
              <Button asChild>
                <Link to={`/menu/${tableId}`}>Browse Menu</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Card className='border-none shadow-none bg-transparent'>
              <CardHeader className='pt-0'>
                <CardTitle className="text-lg font-semibold">Order Items</CardTitle>
              </CardHeader>
              <CardContent >
                <div className="space-y-4">
                  {cart.map((item) => {
                    const itemTotal = item.finalUnitPrice * item.quantity;

                    return (
                      <div
                        key={item.cartItemId}
                        className={`p-3 rounded-lg border ${item.hasValidationError
                          ? 'border-destructive bg-destructive/5'
                          : 'border-border'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{item.name}</h3>
                              {item.hasValidationError && (
                                <span className="text-xs text-destructive">❌</span>
                              )}
                            </div>

                            {/* Selected Options with price adjustments */}
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {item.selectedOptions.map((opt, idx) => (
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
                              ${item.finalUnitPrice.toFixed(2)} each
                            </p>

                            {item.hasValidationError && item.validationReason && (
                              <p className="text-xs text-destructive mt-1">{item.validationReason}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-white rounded-full border border-input bg-background px-2 py-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateCartItem(item.cartItemId, item.quantity - 1)}
                                disabled={item.hasValidationError}
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
                                onClick={() => updateCartItem(item.cartItemId, item.quantity + 1)}
                                disabled={item.hasValidationError}
                                className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeCartItem(item.cartItemId)}
                              className="h-9 w-9 p-3 rounded-full text-destructive hover:text-destructive "
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

                {hasValidationErrors() && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
                    <h4 className="font-semibold text-destructive mb-2">Items No Longer Available</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Some items in your cart are no longer available. Please remove them to continue.
                    </p>
                    <Button size="sm" variant="outline" onClick={handleRemoveUnavailableItems}>
                      Remove Unavailable Items
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className='border-none shadow-none bg-transparent'>
              <CardHeader className='pt-0'>
                <CardTitle className="text-lg font-semibold">Special Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special requests or allergies..."
                  value={notes}
                  onChange={(e) => {
                    // Plain text only - strip any HTML tags and limit to 500 chars
                    const plainText = e.target.value.replace(/<[^>]*>/g, '');
                    if (plainText.length <= 500) {
                      setNotes(plainText);
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

            <Card className='px-4 border-none shadow-none p-0 bg-transparent'>
              <CardContent className="p-6">
                <div className="flex justify-between items-center text-lg font-semibold mb-4">
                  <span>Total</span>
                  <span>${getTotalAmount().toFixed(2)}</span>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={placeOrder}
                  disabled={loading || hasValidationErrors()}
                >
                  {loading ? "Placing Order..." : hasValidationErrors() ? "Remove Unavailable Items First" : "Place Order"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default CartSummary;

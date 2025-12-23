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

      const { data: tableData } = await supabase
        .from('tables')
        .select('*, restaurant:restaurants(*)')
        .eq('id', tableId)
        .single();

      if (tableData) {
        setTable(tableData);
        setRestaurant(tableData.restaurant);
      }
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

      const orderItemsPayload = cart.map((item) => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        price_usd: (item.price_usd || item.price || 0) + (item.optionsTotal || 0),
        notes: item.selectedOptions?.map(o => `${o.groupName}: ${o.label}`).join(', ') || null,
      }));

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
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" asChild className="mr-4">
            <Link to={`/menu/${tableId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order Summary</h1>
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cart.map((item) => {
                    const itemTotal = ((item.price_usd || item.price || 0) + (item.optionsTotal || 0)) * item.quantity;
                    
                    return (
                      <div 
                        key={item.cartItemId} 
                        className={`p-3 rounded-lg border ${
                          item.hasValidationError 
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
                            
                            {/* Selected Options */}
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {item.selectedOptions.map((opt, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    {opt.groupName}: {opt.label}
                                    {opt.price > 0 && ` (+$${opt.price.toFixed(2)})`}
                                  </p>
                                ))}
                              </div>
                            )}
                            
                            <p className="text-sm text-muted-foreground mt-1">
                              ${((item.price_usd || item.price || 0) + (item.optionsTotal || 0)).toFixed(2)} each
                            </p>
                            
                            {item.hasValidationError && item.validationReason && (
                              <p className="text-xs text-destructive mt-1">{item.validationReason}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateCartItem(item.cartItemId, item.quantity - 1)}
                              disabled={item.hasValidationError}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-semibold min-w-[1.5rem] text-center">
                              {item.quantity}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => updateCartItem(item.cartItemId, item.quantity + 1)}
                              disabled={item.hasValidationError}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeCartItem(item.cartItemId)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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

            <Card>
              <CardHeader>
                <CardTitle>Special Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special requests or allergies..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center text-xl font-bold mb-4">
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

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  price_usd?: number;
  price_khr?: number;
  is_available?: boolean;
  image_url?: string;
  quantity: number;
}

const CartSummary = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [table, setTable] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

    // Load cart from localStorage
    const savedCart = localStorage.getItem(`cart_${tableId}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [tableId]);

  const updateCartItem = (itemId: string, quantity: number) => {
    if (quantity === 0) {
      setCart(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCart(prev => prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      ));
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + ((item.price_usd || item.price || 0) * item.quantity), 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    
    setLoading(true);

    try {
      const totalAmount = getTotalAmount();

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurant.id,
          table_id: tableId,
          table_number: table.table_number,
          total_usd: totalAmount,
          customer_notes: notes || null,
          status: 'new'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price_usd: item.price_usd || item.price || 0
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      localStorage.removeItem(`cart_${tableId}`);
      setCart([]);

      toast({
        title: "Order Placed Successfully!",
        description: "Your order has been sent to the kitchen.",
      });

      navigate(`/order-success/${order.id}`);
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

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (tableId) {
      localStorage.setItem(`cart_${tableId}`, JSON.stringify(cart));
    }
  }, [cart, tableId]);

  if (!table || !restaurant) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" onClick={() => navigate(`/menu/${tableId}`)} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order Summary</h1>
            <p className="text-muted-foreground">{restaurant.name} - Table {table.table_number}</p>
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
              <Button onClick={() => navigate(`/menu/${tableId}`)}>
                Browse Menu
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
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ${(item.price_usd || item.price || 0).toFixed(2)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCartItem(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => updateCartItem(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <div className="ml-4 text-right min-w-[4rem]">
                          <span className="font-semibold">
                            ${((item.price_usd || item.price || 0) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                  disabled={loading}
                >
                  {loading ? "Placing Order..." : "Place Order"}
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
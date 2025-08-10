import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  is_available: boolean;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
  menu_items: MenuItem[];
}

interface CartItem extends MenuItem {
  quantity: number;
}

const MenuView = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [table, setTable] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenuData = async () => {
      if (!tableId) return;

      // Fetch table info
      const { data: tableData } = await supabase
        .from('tables')
        .select('*, restaurant:restaurants(*)')
        .eq('id', tableId)
        .single();

      if (!tableData) {
        toast({
          title: "Table Not Found",
          description: "The QR code may be invalid",
          variant: "destructive",
        });
        return;
      }

      setTable(tableData);
      setRestaurant(tableData.restaurant);

      // Fetch menu categories and items
      const { data: categoriesData } = await supabase
        .from('menu_categories')
        .select(`
          *,
          menu_items (
            id,
            name,
            description,
            price_usd,
            is_available,
            category_id
          )
        `)
        .eq('restaurant_id', tableData.restaurant.id)
        .order('display_order');

      setCategories(categoriesData || []);
      setLoading(false);
    };

    fetchMenuData();
  }, [tableId]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(cartItem =>
          cartItem.id === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      }
      return prev.filter(cartItem => cartItem.id !== itemId);
    });
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price_usd * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading menu...</div>;
  }

  if (!table || !restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Table Not Found</h1>
          <p className="text-muted-foreground">The QR code may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{restaurant.name}</h1>
            <p className="text-muted-foreground">Table {table.table_number}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue={categories[0]?.id} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4 mb-6">
            {categories.map((category) => (
              <TabsTrigger key={category.id} value={category.id} className="text-xs">
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="space-y-4">
              {category.menu_items.map((item) => (
                <Card key={item.id} className={!item.is_available ? 'opacity-50' : ''}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold">${item.price_usd.toFixed(2)}</span>
                          {!item.is_available && (
                            <Badge variant="secondary">Unavailable</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {cart.find(cartItem => cartItem.id === item.id) ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-semibold min-w-[2rem] text-center">
                              {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => addToCart(item)}
                              disabled={!item.is_available}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => addToCart(item)}
                            disabled={!item.is_available}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
          <Button
            className="w-full"
            size="lg"
            onClick={() => navigate(`/cart/${tableId}`)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            View Cart ({getTotalItems()}) - ${getTotalAmount().toFixed(2)}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MenuView;
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

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
      setActiveCategory(categoriesData?.[0]?.id || '');
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

  const filteredCategories = categories.map(category => ({
    ...category,
    menu_items: category.menu_items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.menu_items.length > 0);

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-background dark:to-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Restaurant Name */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-primary">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground">Table {table.table_number}</p>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-white dark:bg-muted"
              />
            </div>
            
            {/* Cart Icon */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/cart/${tableId}`)}
              className="relative"
              disabled={cart.length === 0}
            >
              <ShoppingCart className="h-4 w-4" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getTotalItems()}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Category Navigation */}
      <div className="sticky top-[73px] z-9 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {filteredCategories.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-24">
        {searchQuery ? (
          // Search Results
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Search Results for "{searchQuery}"</h2>
            {filteredCategories.map((category) => (
              category.menu_items.length > 0 && (
                <div key={category.id} className="space-y-3">
                  <h3 className="text-md font-medium text-muted-foreground border-b pb-2">
                    {category.name}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {category.menu_items.map((item) => (
                      <Card key={item.id} className={`group hover:shadow-lg transition-all duration-200 ${!item.is_available ? 'opacity-50' : ''}`}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-lg">{item.name}</h4>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-primary">${item.price_usd.toFixed(2)}</span>
                                {!item.is_available && (
                                  <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {cart.find(cartItem => cartItem.id === item.id) ? (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => removeFromCart(item.id)}
                                      className="h-8 w-8 p-0 rounded-full"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="font-semibold min-w-[2rem] text-center">
                                      {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                                    </span>
                                    <Button
                                      size="sm"
                                      onClick={() => addToCart(item)}
                                      disabled={!item.is_available}
                                      className="h-8 w-8 p-0 rounded-full"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => addToCart(item)}
                                    disabled={!item.is_available}
                                    className="rounded-full px-4"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            ))}
            {filteredCategories.every(cat => cat.menu_items.length === 0) && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No items found matching your search.</p>
              </div>
            )}
          </div>
        ) : (
          // Category View
          <div className="space-y-6">
            {filteredCategories.find(cat => cat.id === activeCategory)?.menu_items && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCategories.find(cat => cat.id === activeCategory)?.menu_items.map((item) => (
                  <Card key={item.id} className={`group hover:shadow-lg transition-all duration-200 ${!item.is_available ? 'opacity-50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-lg">{item.name}</h4>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-primary">${item.price_usd.toFixed(2)}</span>
                            {!item.is_available && (
                              <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {cart.find(cartItem => cartItem.id === item.id) ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFromCart(item.id)}
                                  className="h-8 w-8 p-0 rounded-full"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="font-semibold min-w-[2rem] text-center">
                                  {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() => addToCart(item)}
                                  disabled={!item.is_available}
                                  className="h-8 w-8 p-0 rounded-full"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => addToCart(item)}
                                disabled={!item.is_available}
                                className="rounded-full px-4"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white to-transparent dark:from-background dark:to-transparent p-4 pt-8">
          <Button
            className="w-full h-12 text-base font-semibold rounded-full shadow-lg"
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
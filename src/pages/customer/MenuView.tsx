import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import OrderStatusTracker from '@/components/OrderStatusTracker';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  is_available: boolean;
  category_id: string;
  image_url?: string;
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
  const [searchInput, setSearchInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  // Track active orders for this table
  const { activeOrders } = useActiveOrders(tableId || '');

  useEffect(() => {
    const fetchMenuData = async () => {
      if (!tableId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch table info (robust: support both UUID id and plain table number)
        const isUuid = (val: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

        let tableData: any = null;
        let tableError: any = null;

        if (isUuid(tableId)) {
          const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('id', tableId)
            .maybeSingle();
          tableData = data;
          tableError = error;
        }

        // Fallback: if not a UUID, or lookup by id failed, try by table_number
        if (!tableData) {
          const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('table_number', tableId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          tableData = data;
          tableError = tableError ?? error;
        }

        if (!tableData) {
          console.error('Table fetch error:', tableError);
          setLoading(false);
          toast({
            title: "Table Not Found",
            description: tableError?.message || "The QR code may be invalid or the table was removed.",
            variant: "destructive",
          });
          return;
        }

        setTable(tableData);

        // Fetch restaurant info
        const { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', tableData.restaurant_id)
          .maybeSingle();

        if (restaurantError || !restaurantData) {
          console.error('Restaurant fetch error:', restaurantError);
          setLoading(false);
          toast({
            title: "Restaurant Not Found",
            description: "Unable to load restaurant information",
            variant: "destructive",
          });
          return;
        }

        setRestaurant(restaurantData);

        // Fetch menu categories and items
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('menu_categories')
          .select(`
            *,
            menu_items (
              id,
              name,
              description,
              price_usd,
              is_available,
              category_id,
              image_url
            )
          `)
          .eq('restaurant_id', restaurantData.id)
          .order('display_order');

        if (categoriesError) {
          console.error('Categories fetch error:', categoriesError);
          toast({
            title: "Error Loading Menu",
            description: "Unable to load menu items. Please try again.",
            variant: "destructive",
          });
        }

        setCategories(categoriesData || []);
        setActiveCategory(categoriesData?.[0]?.id || '');
        setLoading(false);
      } catch (error) {
        console.error('Unexpected error:', error);
        setLoading(false);
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchMenuData();
  }, [tableId, toast]);

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

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (tableId) {
      if (cart.length > 0) {
        localStorage.setItem(`cart_${tableId}`, JSON.stringify(cart));
      } else {
        localStorage.removeItem(`cart_${tableId}`);
      }
    }
  }, [cart, tableId]);

  // Load cart from localStorage on component mount
  useEffect(() => {
    if (tableId) {
      const savedCart = localStorage.getItem(`cart_${tableId}`);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    }
  }, [tableId]);

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

  const handleSearchExpand = () => {
    setIsSearchExpanded(true);
    // Focus will be handled by useEffect
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  const handleSearchClose = () => {
    setIsSearchExpanded(false);
    setSearchQuery('');
    setSearchInput('');
  };

  // Auto focus when search expands
  useEffect(() => {
    if (isSearchExpanded) {
      const searchInput = document.querySelector('input[placeholder="Search menu items..."]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  }, [isSearchExpanded]);

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
          {!isSearchExpanded ? (
            // Normal view - Restaurant name and search/cart
            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary">{restaurant.name}</h1>
                <p className="text-xs text-muted-foreground font-medium">Table {table.table_number}</p>
              </div>
              
              {/* Desktop Search Field - Centered */}
              <div className="hidden md:flex flex-1 justify-center">
                <div className="relative max-w-md w-full">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" 
                    onClick={handleSearch} />
                  <Input
                    placeholder="Search menu items..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pr-10 h-10 bg-white dark:bg-muted text-sm"
                  />
                </div>
              </div>
              
              {/* Mobile and Desktop Icons - Right Aligned */}
              <div className="flex items-center gap-2 ml-auto md:ml-0">
                {/* Mobile Search Icon */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearchExpand}
                  className="h-9 w-9 p-0 md:hidden"
                >
                  <Search className="h-4 w-4" />
                </Button>
                
                {/* Cart Icon */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/cart/${tableId}`)}
                  className="relative h-9 w-9 p-0"
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
          ) : (
            // Mobile Search expanded view
            <div className="flex items-center gap-3 animate-fade-in md:hidden">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" 
                  onClick={handleSearch} />
                <Input
                  placeholder="Search menu items..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pr-10 h-10 bg-white dark:bg-muted text-base"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSearchClose}
                className="h-10 w-10 p-0 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Category Navigation */}
      {!searchQuery && (
        <div className="sticky top-[73px] z-20 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
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
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-24">
        {searchQuery ? (
          // Search Results
          <div className="space-y-8">
            {filteredCategories.map((category) => (
              category.menu_items.length > 0 && (
                <div key={category.id} className="space-y-6">
                  <div className="flex items-center">
                    <h3 className="text-lg font-semibold text-foreground bg-muted/30 px-4 py-2 rounded-full border">
                      {category.name}
                    </h3>
                  </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                       {category.menu_items.map((item) => (
                         <div key={item.id} className={`bg-card/70 backdrop-blur-sm rounded-xl shadow-sm border border-border/50 hover:shadow-md hover:bg-card transition-all duration-200 overflow-hidden w-full ${!item.is_available ? 'opacity-50' : ''}`}>
                          {/* Product Image */}
                          <div className="aspect-[3/2] bg-muted relative overflow-hidden">
                            {item.image_url ? (
                              <img 
                                src={item.image_url} 
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                                <span className="text-muted-foreground text-2xl">🍽️</span>
                              </div>
                            )}
                          </div>
                         
                           {/* Card Content */}
                           <div className="p-4 space-y-3 h-32 flex flex-col">
                             <div className="space-y-1 flex-1">
                               <h4 className="font-semibold text-card-foreground text-base leading-tight line-clamp-1">{item.name}</h4>
                               {item.description && (
                                 <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">{item.description}</p>
                               )}
                             </div>
                           
                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center gap-2">
                                <span className="text-primary font-bold text-xl">${item.price_usd.toFixed(2)}</span>
                               {!item.is_available && (
                                 <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                               )}
                             </div>
                             
                             {cart.find(cartItem => cartItem.id === item.id) ? (
                               <div className="flex items-center space-x-2">
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => removeFromCart(item.id)}
                                   className="h-9 w-9 p-0 rounded-full"
                                 >
                                   <Minus className="h-4 w-4" />
                                 </Button>
                                 <span className="text-base font-semibold min-w-[24px] text-center">
                                   {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                                 </span>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => addToCart(item)}
                                   disabled={!item.is_available}
                                   className="h-9 w-9 p-0 rounded-full"
                                 >
                                   <Plus className="h-4 w-4" />
                                 </Button>
                               </div>
                             ) : (
                               <Button
                                 onClick={() => addToCart(item)}
                                 disabled={!item.is_available}
                                 className="h-9 px-4 rounded-full font-medium"
                               >
                                 Add to Cart
                               </Button>
                             )}
                           </div>
                         </div>
                       </div>
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
          <div className="space-y-8">
            {filteredCategories.find(cat => cat.id === activeCategory)?.menu_items && (
               <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredCategories.find(cat => cat.id === activeCategory)?.menu_items.map((item) => (
                    <div key={item.id} className={`bg-card/70 backdrop-blur-sm rounded-xl shadow-sm border border-border/50 hover:shadow-md hover:bg-card transition-all duration-200 overflow-hidden w-full ${!item.is_available ? 'opacity-50' : ''}`}>
                      {/* Product Image */}
                      <div className="aspect-[3/2] bg-muted relative overflow-hidden">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                            <span className="text-muted-foreground text-2xl">🍽️</span>
                          </div>
                        )}
                      </div>
                     
                       {/* Card Content */}
                       <div className="p-4 space-y-3 h-32 flex flex-col">
                         <div className="space-y-1 flex-1">
                           <h4 className="font-semibold text-card-foreground text-base leading-tight line-clamp-1">{item.name}</h4>
                           {item.description && (
                             <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">{item.description}</p>
                           )}
                         </div>
                       
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-bold text-xl">${item.price_usd.toFixed(2)}</span>
                           {!item.is_available && (
                             <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                           )}
                         </div>
                         
                         {cart.find(cartItem => cartItem.id === item.id) ? (
                           <div className="flex items-center space-x-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => removeFromCart(item.id)}
                               className="h-9 w-9 p-0 rounded-full"
                             >
                               <Minus className="h-4 w-4" />
                             </Button>
                             <span className="text-base font-semibold min-w-[24px] text-center">
                               {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                             </span>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => addToCart(item)}
                               disabled={!item.is_available}
                               className="h-9 w-9 p-0 rounded-full"
                             >
                               <Plus className="h-4 w-4" />
                             </Button>
                           </div>
                         ) : (
                           <Button
                             onClick={() => addToCart(item)}
                             disabled={!item.is_available}
                             className="h-9 px-4 rounded-full font-medium"
                           >
                             Add to Cart
                           </Button>
                         )}
                       </div>
                     </div>
                   </div>
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

      {/* Order Status Tracker */}
      <OrderStatusTracker 
        orders={activeOrders} 
        onViewDetails={(orderId) => navigate(`/order-success/${orderId}`)}
      />
    </div>
  );
};

export default MenuView;
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import { Trash2, ShoppingCart, Plus, Minus, Search, X, Package2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/hooks/useCart';
import { useActiveOrders } from '@/hooks/useActiveOrders';

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

const MenuView = () => {
  const { tableId } = useParams();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [table, setTable] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Use shared cart hook
  const {
    cart,
    isLoaded: cartLoaded,
    addToCart,
    removeFromCart,
    clearCart,
    getTotalAmount,
    getTotalItems,
  } = useCart(tableId);

  // Get active orders count for badge
  const { activeOrders } = useActiveOrders(tableId || '');

  const fetchMenuData = async () => {
    if (!tableId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch table info using secure RPC (prevents bulk enumeration)
      const isUuid = (val: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

      let tableData: any = null;
      let tableError: any = null;

      if (isUuid(tableId)) {
        // Use secure RPC function instead of direct table access
        const { data, error } = await supabase
          .rpc('get_public_table', { p_table_id: tableId });
        // RPC returns an array, get first result
        tableData = data?.[0] || null;
        tableError = error;
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

      // Fetch restaurant info using public view (excludes owner_id for privacy)
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('public_restaurants')
        .select('id, name')
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

      // Fetch menu categories using secure RPC (prevents bulk enumeration)
      const { data: categoriesData, error: categoriesError } = await supabase
        .rpc('get_public_menu_categories', { p_restaurant_id: restaurantData.id });

      if (categoriesError) {
        console.error('Categories fetch error:', categoriesError);
        toast({
          title: "Error Loading Menu",
          description: "Unable to load menu items. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch menu items for this restaurant (RLS ensures only available items are returned) - newest first
      const { data: menuItemsData, error: menuItemsError } = await supabase
        .from('menu_items')
        .select('id, name, description, price_usd, is_available, category_id, image_url, created_at')
        .eq('restaurant_id', restaurantData.id)
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      if (menuItemsError) {
        console.error('Menu items fetch error:', menuItemsError);
        toast({
          title: "Error Loading Menu",
          description: "Unable to load menu items. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Combine categories with their menu items
      const categoriesWithItems = (categoriesData || []).map((category: any) => ({
        ...category,
        menu_items: (menuItemsData || []).filter((item: any) => item.category_id === category.id)
      }));

      setCategories(categoriesWithItems);
      if (!activeCategory && categoriesWithItems[0]?.id) {
        setActiveCategory(categoriesWithItems[0].id);
      }
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

  useEffect(() => {
    fetchMenuData();
  }, [tableId, toast]);

  // Subscribe to realtime updates for menu items and categories
  useEffect(() => {
    if (!restaurant?.id) return;

    const menuItemsChannel = supabase
      .channel('menu-items-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          console.log('Menu item change:', payload.eventType);
          fetchMenuData();
        }
      )
      .subscribe();

    const categoriesChannel = supabase
      .channel('menu-categories-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_categories',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          console.log('Category change:', payload.eventType);
          fetchMenuData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(menuItemsChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, [restaurant?.id]);

  //   const clearCart = () => {
  //   setCart([]); // assuming you're storing cart in state
  //   localStorage.removeItem(`cart-${tableId}`); // if you're persisting
  // };

  const handleSearchExpand = () => {
    setIsSearchExpanded(true);
    // Focus will be handled by useEffect
  };

  const handleSearchClose = () => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  };

  const scrollRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    setIsScrolled(scrollRef.current.scrollLeft > 0);
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

  // Filter items based on search query AND active category
  const filteredCategories = categories.map(category => ({
    ...category,
    menu_items: category.menu_items.filter(item => {
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !searchQuery || category.id === activeCategory;
      return matchesSearch && matchesCategory;
    })
  })).filter(category => category.menu_items.length > 0);

  // Set default activeCategory to first filtered category with items
  useEffect(() => {
    if (filteredCategories.length > 0) {
      setActiveCategory((prev) => {
        // If current activeCategory is not in filteredCategories, reset to first
        if (!filteredCategories.some(cat => cat.id === prev)) {
          return filteredCategories[0].id;
        }
        return prev;
      });
    }
  }, [filteredCategories.length]);

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
    <div className="min-h-screen">
      {/* Top Navigation */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          {!isSearchExpanded ? (
            // Normal view - Restaurant name and search/cart
            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                <h4 className="text-2xl font-bold text-primary">{restaurant.name}</h4>
              </div>

              {/* Desktop Search Field - Centered */}
              <div className="hidden md:flex flex-1 justify-center">
                <div className="relative max-w-lg w-full">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => document.getElementById('search-input')?.focus()}
                  />
                  <Input
                    id="search-input"
                    placeholder="Search menu items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ×
                    </button>
                  )}
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

                {/* My Orders Icon */}
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="relative h-9 w-9 p-0"
                >
                  <Link to={`/my-orders/${tableId}`}>
                    <Package2 className="h-4 w-4" />
                    {activeOrders.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {activeOrders.length}
                      </span>
                    )}
                  </Link>
                </Button>

                {/* Cart Icon */}
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="relative h-9 w-9 p-0"
                  disabled={cart.length === 0}
                >
                  <Link to={`/cart/${tableId}`}>
                    <ShoppingCart className="h-4 w-4" />
                    {cart.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {getTotalItems()}
                      </span>
                    )}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            // Mobile Search expanded view
            <div className="flex items-center gap-3 animate-fade-in md:hidden">
              <div className="flex-1 relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => document.getElementById('search-input')?.focus()}
                />
                <Input
                  id="search-input"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8"
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
      <div className="sticky top-[61px] z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md">
        <div
          className={`container mx-auto pr-0 py-3 transition-all ${isScrolled ? "pl-0" : "pl-4"
            }`}
        >
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-2 overflow-x-auto scrollbar-hide"
          >
            {(
              searchQuery
                ? categories.filter(cat => cat.menu_items && cat.menu_items.length > 0)
                : filteredCategories
            ).map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-regular transition-all"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </div>


      {/* Main Content */}
      <main className="container mx-auto px-2 py-2 pb-24">
        <div className="space-y-8">
          {filteredCategories.find(cat => cat.id === activeCategory)?.menu_items &&
            filteredCategories.find(cat => cat.id === activeCategory)!.menu_items.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
              {filteredCategories
                .filter(cat => cat.menu_items.length > 0)
                .find(cat => cat.id === activeCategory)?.menu_items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-200 ${!item.is_available ? 'opacity-50' : ''}`}
                  >
                    {/* Product Image */}
                    <div className="relative w-full aspect-square bg-muted rounded-2xl">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80 rounded-2xl">
                          <span className="text-muted-foreground text-8xl">🍽️</span>
                        </div>
                      )}

                      {/* Add Button Overlay */}
                      <div className="absolute bottom-3 right-3">
                        {cart.find(cartItem => cartItem.id === item.id) ? (
                          <div className="flex items-center gap-2 bg-white rounded-full shadow-lg px-2 py-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.id)}
                              className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-semibold min-w-[20px] text-center">
                              {cart.find(cartItem => cartItem.id === item.id)?.quantity || 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addToCart(item)}
                              disabled={!item.is_available}
                              className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => addToCart(item)}
                            disabled={!item.is_available}
                            size="sm"
                            className="h-9 w-9 p-0 rounded-full shadow-lg"
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3">
                      <h6 className="font-medium text-card-foreground text-sm md:text-base line-clamp-2 mb-1">{item.name}</h6>
                      <div className="flex items-center justify-between">
                        <span className="text-primary font-bold text-base md:text-lg">${item.price_usd.toFixed(2)}</span>
                        {!item.is_available && (
                          <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
              <Search className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                {searchQuery ? `No items found matching "${searchQuery}" in this category.` : 'No items in this category.'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Fixed Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white to-transparent dark:from-background dark:to-transparent p-4 pt-8 pb-4 z-40">
          <div className="flex gap-3 items-end relative md:justify-center left-0 right-0">
            <Button
              variant="custom"
              className="
                h-10 bg-white text-white rounded-full shadow-lg flex items-center justify-center
                w-10
              "
              onClick={() => {
                clearCart();
              }}
            >
              <X className="h-5 w-5 text-muted-foreground" />
              {/* <span className="hidden md:inline">Cancel</span> */}
            </Button>

            {/* View Cart Button */}
            <Button
              variant="custom"
              className="
                h-10 bg-primary text-white text-sm font-semibold rounded-full shadow-lg
                flex-1 md:w-1/2 md:flex-none
              "
              size="sm"
              asChild
            >
              <Link
                to={`/cart/${tableId}`}
                className="flex items-center justify-center"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                View Cart ({getTotalItems()}) – ${getTotalAmount().toFixed(2)}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuView;
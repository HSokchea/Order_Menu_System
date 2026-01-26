import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Search, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useDeviceOrder, OrderItem } from '@/hooks/useDeviceOrder';
import ItemDetailSheet, { ItemOptions, SizeOption } from '@/components/customer/ItemDetailSheet';
import { SelectedOption } from '@/hooks/useCart';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  is_available: boolean;
  category_id: string;
  image_url?: string;
  options?: ItemOptions | null;
  size_enabled?: boolean;
  sizes?: SizeOption[] | null;
}

interface Category {
  id: string;
  name: string;
  menu_items: MenuItem[];
}

interface ShopInfo {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
}

const WebMenu = () => {
  const { shopId } = useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  // Item detail sheet state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isItemSheetOpen, setIsItemSheetOpen] = useState(false);

  // Use device-based order hook
  const {
    order,
    isLoading: orderLoading,
    isExistingOrder,
    error: orderError,
    addItem,
    removeItem,
    updateItemQuantity,
    clearOrder,
  } = useDeviceOrder(shopId);

  const fetchMenuData = async () => {
    if (!shopId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch shop info using secure RPC
      const { data: shopResult, error: shopError } = await supabase
        .rpc('get_public_shop', { p_shop_id: shopId });

      const shopData = shopResult?.[0] || null;

      if (shopError || !shopData) {
        console.error('Shop fetch error:', shopError);
        setLoading(false);
        toast.error("Shop not found. The QR code may be invalid.");
        return;
      }

      setShop(shopData);

      // Fetch menu categories using secure RPC
      const { data: categoriesData, error: categoriesError } = await supabase
        .rpc('get_public_menu_categories', { p_restaurant_id: shopData.id });

      if (categoriesError) {
        console.error('Categories fetch error:', categoriesError);
        toast.error("Unable to load menu categories.");
        setLoading(false);
        return;
      }

      // Fetch menu items using secure RPC
      const { data: menuItemsData, error: menuItemsError } = await supabase
        .rpc('get_shop_menu_items', { p_shop_id: shopData.id });

      if (menuItemsError) {
        console.error('Menu items fetch error:', menuItemsError);
        toast.error("Unable to load menu items.");
        setLoading(false);
        return;
      }

      // Combine categories with their menu items
      const categoriesWithItems = (categoriesData || []).map((category: any) => ({
        ...category,
        menu_items: (menuItemsData || [])
          .filter((item: any) => item.category_id === category.id)
          .map((item: any) => ({
            ...item,
            options: item.options as ItemOptions | null,
            sizes: item.sizes as SizeOption[] | null,
          }))
      }));

      setCategories(categoriesWithItems);
      if (!activeCategory && categoriesWithItems[0]?.id) {
        setActiveCategory(categoriesWithItems[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      setLoading(false);
      toast.error("Something went wrong. Please try again.");
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, [shopId]);

  // Show notification if resuming existing order
  useEffect(() => {
    if (isExistingOrder && order && order.items.length > 0) {
      toast.info(`Resuming your order with ${order.items.length} item(s)`);
    }
  }, [isExistingOrder]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    setIsScrolled(scrollRef.current.scrollLeft > 0);
  };

  const handleSearchExpand = () => {
    setIsSearchExpanded(true);
  };

  const handleSearchClose = () => {
    setIsSearchExpanded(false);
    setSearchQuery('');
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

  // Get item count from order
  const getItemCount = (menuItemId: string): number => {
    if (!order) return 0;
    return order.items
      .filter(item => item.menu_item_id === menuItemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get total items in order
  const getTotalItems = (): number => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Handle item click - open detail sheet if has options or sizes
  const handleItemClick = (item: MenuItem) => {
    const hasOptions = item.options?.options && item.options.options.length > 0;
    const hasSizes = item.size_enabled && item.sizes && item.sizes.length > 0;
    if (hasOptions || hasSizes) {
      setSelectedItem(item);
      setIsItemSheetOpen(true);
    } else {
      handleQuickAdd(item);
    }
  };

  // Handle quick add
  const handleQuickAdd = async (item: MenuItem) => {
    const orderItem: OrderItem = {
      id: item.id,
      menu_item_id: item.id,
      name: item.name,
      quantity: 1,
      price_usd: item.price_usd,
    };

    try {
      await addItem(orderItem);
      toast.success(`${item.name} added to your order`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add item');
    }
  };

  // Handle quick remove
  const handleQuickRemove = async (e: React.MouseEvent, menuItemId: string) => {
    e.stopPropagation();
    const item = order?.items.find(i => i.menu_item_id === menuItemId);
    if (!item) return;

    try {
      if (item.quantity > 1) {
        await updateItemQuantity(menuItemId, item.quantity - 1);
      } else {
        await removeItem(menuItemId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove item');
    }
  };

  // Handle add to cart with options from detail sheet
  const handleAddToCartWithOptions = async (item: MenuItem, quantity: number, selectedOptions?: SelectedOption[]) => {
    // Determine base price
    let basePrice = item.price_usd;
    if (item.size_enabled && selectedOptions) {
      const sizeOption = selectedOptions.find(o => o.groupName === 'Size');
      if (sizeOption) {
        basePrice = sizeOption.price;
      }
    }

    const orderItem: OrderItem = {
      id: item.id,
      menu_item_id: item.id,
      name: item.name,
      quantity,
      price_usd: basePrice,
      options: selectedOptions?.filter(o => o.groupName !== 'Size'),
    };

    try {
      await addItem(orderItem);
      toast.success(`${quantity}x ${item.name} added to your order`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add item');
    }
  };

  if (loading || orderLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading menu...</div>;
  }

  if (!shop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Shop Not Found</h1>
          <p className="text-muted-foreground">The QR code may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (orderError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground">{orderError}</p>
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
            <div className="flex items-center justify-between gap-4">
              <div className="flex-shrink-0 flex items-center gap-3">
                {shop.logo_url && (
                  <img src={shop.logo_url} alt={shop.name} className="h-10 w-10 rounded-full object-cover" />
                )}
                <h4 className="text-2xl font-bold text-primary">{shop.name}</h4>
              </div>

              {/* Desktop Search Field */}
              <div className="hidden md:flex flex-1 justify-center">
                <div className="relative max-w-lg w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search menu items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Icons */}
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
                  asChild
                  className="relative h-9 w-9 p-0"
                >
                  <Link to={`/menu/${shopId}/cart`}>
                    <ShoppingCart className="h-4 w-4" />
                    {getTotalItems() > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {getTotalItems()}
                      </span>
                    )}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            /* Mobile Search expanded view */
            <div className="flex items-center gap-3 animate-fade-in md:hidden">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
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

      {/* Category Pills */}
      <div className="sticky top-[61px] z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md">
        <div className={`container mx-auto pr-0 py-3 transition-all ${isScrolled ? "pl-0" : "pl-4"}`}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-2 overflow-x-auto scrollbar-hide"
          >
            {(searchQuery
              ? categories.filter(cat => cat.menu_items.length > 0)
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
            <div className="grid grid-cols-2 md:flex lg:flex gap-2 md:gap-4 lg:gap-6 justify-start">
              {filteredCategories
                .filter(cat => cat.menu_items.length > 0)
                .find(cat => cat.id === activeCategory)?.menu_items.map((item) => {
                  const itemCount = getItemCount(item.id);
                  const hasOptions = item.options?.options && item.options.options.length > 0;
                  
                  // Get display price
                  const displayPrice = (() => {
                    if (item.size_enabled && item.sizes && item.sizes.length > 0) {
                      const defaultSize = item.sizes.find(s => s.default);
                      return defaultSize ? defaultSize.price : item.sizes[0].price;
                    }
                    return item.price_usd;
                  })();
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer ${!item.is_available ? 'opacity-50' : ''}`}
                    >
                      {/* Product Image */}
                      <div className="relative h-48 w-48 aspect-square bg-muted rounded-2xl">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-2xl"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80 rounded-2xl">
                            <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                          </div>
                        )}

                        {/* Add Button Overlay */}
                        <div className="absolute bottom-3 right-3">
                          {itemCount > 0 && !hasOptions ? (
                            <div className="flex items-center gap-2 bg-white rounded-full shadow-lg px-2 py-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleQuickRemove(e, item.id)}
                                className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="text-sm font-semibold min-w-[20px] text-center">
                                {itemCount}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAdd(item);
                                }}
                                disabled={!item.is_available}
                                className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                              disabled={!item.is_available}
                              variant='outline'
                              size="sm"
                              className="h-9 w-9 p-0 rounded-full shadow-sm"
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
                          <span className="text-primary font-bold text-base md:text-lg">${displayPrice.toFixed(2)}</span>
                          {!item.is_available && (
                            <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
      {order && order.items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white to-transparent dark:from-background dark:to-transparent p-4 pt-8 pb-4 z-40">
          <div className="flex gap-3 items-end relative md:justify-center left-0 right-0">
            <Button
              variant="custom"
              className="h-10 bg-white text-white rounded-full shadow-lg flex items-center justify-center w-10"
              onClick={() => {
                clearOrder();
                toast.success('Order cleared');
              }}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>

            <Button
              variant="custom"
              className="h-10 bg-primary text-white text-sm font-semibold rounded-full shadow-lg flex-1 md:w-1/2 md:flex-none"
              size="sm"
              asChild
            >
              <Link to={`/web/${shopId}/cart`} className="flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                View Cart ({getTotalItems()}) – ${order.total_usd.toFixed(2)}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Item Detail Sheet */}
      <ItemDetailSheet
        item={selectedItem}
        open={isItemSheetOpen}
        onOpenChange={setIsItemSheetOpen}
        onAddToCart={handleAddToCartWithOptions}
      />
    </div>
  );
};

export default WebMenu;

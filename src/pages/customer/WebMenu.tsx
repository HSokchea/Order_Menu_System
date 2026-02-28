import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Search, X, ImageIcon, ClipboardList, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useLocalCart, LocalCartItem } from "@/hooks/useLocalCart";
import ItemDetailSheet, { ItemOptions, SizeOption } from "@/components/customer/ItemDetailSheet";
import { SelectedOption } from "@/hooks/useCart";
import { WiFiGate } from "@/components/customer/WiFiGate";

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
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table_id");
  const [categories, setCategories] = useState<Category[]>([]);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Item detail sheet state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isItemSheetOpen, setIsItemSheetOpen] = useState(false);

  // Use LOCAL cart only - NO backend calls during browsing
  const {
    items,
    total,
    isLoaded: cartLoaded,
    addItem,
    removeByMenuItemId,
    clearCart,
    getItemCount,
    getTotalItems,
  } = useLocalCart(shopId, tableId);

  const fetchMenuData = async () => {
    if (!shopId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch shop info using secure RPC
      const { data: shopResult, error: shopError } = await supabase.rpc("get_public_shop", { p_shop_id: shopId });

      const shopData = shopResult?.[0] || null;

      if (shopError || !shopData) {
        console.error("Shop fetch error:", shopError);
        setLoading(false);
        toast.error("Shop not found. The QR code may be invalid.");
        return;
      }
      setShop(shopData);

      // Fetch menu categories using secure RPC
      const { data: categoriesData, error: categoriesError } = await supabase.rpc("get_public_menu_categories", {
        p_restaurant_id: shopData.id,
      });

      if (categoriesError) {
        console.error("Categories fetch error:", categoriesError);
        toast.error("Unable to load menu categories.");
        setLoading(false);
        return;
      }

      // Fetch menu items using secure RPC
      const { data: menuItemsData, error: menuItemsError } = await supabase.rpc("get_shop_menu_items", {
        p_shop_id: shopData.id,
      });

      if (menuItemsError) {
        console.error("Menu items fetch error:", menuItemsError);
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
          })),
      }));

      setCategories(categoriesWithItems);
      if (!activeCategory && categoriesWithItems[0]?.id) {
        setActiveCategory(categoriesWithItems[0].id);
      }
      setLoading(false);
    } catch (error) {
      console.error("Unexpected error:", error);
      setLoading(false);
      toast.error("Something went wrong. Please try again.");
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, [shopId]);

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
    setSearchQuery("");
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
  const filteredCategories = categories
    .map((category) => ({
      ...category,
      menu_items: category.menu_items.filter((item) => {
        const matchesSearch =
          !searchQuery ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !searchQuery || category.id === activeCategory;
        return matchesSearch && matchesCategory;
      }),
    }))
    .filter((category) => category.menu_items.length > 0);

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

  // Handle quick add - LOCAL ONLY, no backend call
  const handleQuickAdd = (item: MenuItem) => {
    const cartItem: LocalCartItem = {
      id: `${item.id}-${Date.now()}`,
      menu_item_id: item.id,
      image_url: item.image_url,
      name: item.name,
      quantity: 1,
      price_usd: item.price_usd,
    };
    addItem(cartItem);
  };

  // Handle quick remove - LOCAL ONLY, no backend call
  const handleQuickRemove = (e: React.MouseEvent, menuItemId: string) => {
    e.stopPropagation();
    removeByMenuItemId(menuItemId);
  };

  // Handle add to cart with options from detail sheet - LOCAL ONLY
  const handleAddToCartWithOptions = (item: MenuItem, quantity: number, selectedOptions?: SelectedOption[]) => {
    // Determine base price
    let basePrice = item.price_usd;
    if (item.size_enabled && selectedOptions) {
      const sizeOption = selectedOptions.find((o) => o.groupName === "Size");
      if (sizeOption) {
        basePrice = sizeOption.price;
      }
    }

    const cartItem: LocalCartItem = {
      id: `${item.id}-${Date.now()}`,
      menu_item_id: item.id,
      image_url: item.image_url,
      name: item.name,
      quantity,
      price_usd: basePrice,
      options: selectedOptions?.filter((o) => o.groupName !== 'Size'),
    };
    console.log("Adding to cart:", cartItem);
    addItem(cartItem);
    toast.success(`${quantity}x ${item.name} added to cart`);
  };

  if (loading || !cartLoaded) {
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

  const totalItems = getTotalItems();

  return (
    <WiFiGate shopId={shopId!}>
      <div className="min-h-screen">
        {/* Top Navigation */}
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md">
          <div className="container mx-auto px-4 py-3">
            {!isSearchExpanded ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex-shrink-0 flex items-center gap-3">
                  {shop.logo_url && shop.logo_url.trim() !== "" && (
                    <img src={shop.logo_url} alt={shop.name} className="h-10 w-10 rounded-full object-cover" />
                  )}
                  <h4 className="text-lg font-bold text-primary">{shop.name}</h4>
                </div>

                {/* Desktop Search Field */}
                <div className="hidden md:flex flex-1 justify-center">
                  <div className="relative max-w-lg w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search menu items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-8 rounded-full"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Icons */}
                <div className="flex items-center gap-0 ml-auto md:ml-0">
                  {/* Mobile Search Icon */}
                  <Button variant="ghost" size="sm" onClick={handleSearchExpand} className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 md:hidden">
                    <Search className="h-4 w-4" />
                  </Button>

                  {/* Active Order Button */}
                  <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-full hover:bg-gray-100">
                    <Link
                      to={
                        tableId
                          ? `/menu/${shopId}/order?table_id=${tableId}`
                          : `/menu/${shopId}/order`
                      }
                      className="flex items-center justify-center"
                    >
                      <ClipboardList className="h-4 w-4" />
                    </Link>
                  </Button>

                  {/* Bill Button */}
                  <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-full hover:bg-gray-100">
                    <Link
                      to={
                        tableId
                          ? `/menu/${shopId}/bill?table_id=${tableId}`
                          : `/menu/${shopId}/bill`
                      }
                      className="flex items-center justify-center"
                    >
                      <Receipt className="h-4 w-4" />
                    </Link>
                  </Button>

                  {/* Cart Icon */}
                  <Button variant="ghost" size="sm" asChild className="relative h-8 w-8 p-0 rounded-full hover:bg-gray-100">
                    <Link
                      to={
                        tableId
                          ? `/menu/${shopId}/cart?table_id=${tableId}`
                          : `/menu/${shopId}/cart`
                      }
                      className="flex items-center justify-center"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {totalItems > 0 && (
                        <span className="absolute -top-1.5 -right-0.5 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {totalItems > 9 ? "9+" : totalItems}
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
                    className="pl-9 pr-8 rounded-full"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleSearchClose} className="h-10 w-10 p-0 rounded-full flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Category Pills */}
        <div className="sticky top-[58px] z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md">
          <div className={`container mx-auto pr-0 py-3 transition-all ${isScrolled ? "pl-0" : "pl-4"}`}>
            <div ref={scrollRef} onScroll={handleScroll} className="flex gap-2 overflow-x-auto scrollbar-hide">
              {(searchQuery ? categories.filter((cat) => cat.menu_items.length > 0) : filteredCategories).map(
                (category) => (
                  <Button
                    key={category.id}
                    variant={activeCategory === category.id ? "highlight" : "secondary"}
                    size="custom"
                    onClick={() => setActiveCategory(category.id)}
                    className="whitespace-nowrap rounded-full text-sm font-regular transition-all h-8 px-3"
                  >
                    {category.name}
                  </Button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="container mx-auto px-2 py-2 pb-24 overflow-hidden">
          <div className="space-y-8">
            {filteredCategories.find((cat) => cat.id === activeCategory)?.menu_items &&
              filteredCategories.find((cat) => cat.id === activeCategory)!.menu_items.length > 0 ? (
              <div className="grid grid-cols-2 md:flex lg:flex gap-2 md:gap-4 lg:gap-6 justify-start">
                {filteredCategories
                  .filter((cat) => cat.menu_items.length > 0)
                  .find((cat) => cat.id === activeCategory)
                  ?.menu_items.map((item) => {
                    const itemCount = getItemCount(item.id);
                    const hasOptions = item.options?.options && item.options.options.length > 0;

                    // Get display price
                    const displayPrice = (() => {
                      if (item.size_enabled && item.sizes && item.sizes.length > 0) {
                        const defaultSize = item.sizes.find((s) => s.default);
                        return defaultSize ? defaultSize.price : item.sizes[0].price;
                      }
                      return item.price_usd;
                    })();

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer ${!item.is_available ? "opacity-50" : ""}`}
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
                              <div className="flex items-center gap-2 bg-white rounded-full shadow-lg px-1 py-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleQuickRemove(e, item.id)}
                                  className="h-7 w-7 p-0 rounded-full hover:bg-gray-100"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-semibold min-w-[20px] text-center">{itemCount}</span>
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
                                variant="outline"
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
                          <h6 className="font-medium text-card-foreground text-sm md:text-base line-clamp-2 mb-1">
                            {item.name}
                          </h6>
                          <div className="flex items-center justify-between">
                            <span className="text-primary font-bold text-base md:text-lg">
                              ${displayPrice.toFixed(2)}
                            </span>
                            {!item.is_available && (
                              <Badge variant="secondary" className="text-xs">
                                Unavailable
                              </Badge>
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
                  {searchQuery
                    ? `No items found matching "${searchQuery}" in this category.`
                    : "No items in this category."}
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Fixed Cart Button */}
        {totalItems > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white to-transparent dark:from-background dark:to-transparent p-4 pt-8 pb-4 z-40">
            <div className="flex gap-3 items-end relative md:justify-center left-0 right-0">
              <Button
                variant="custom"
                className="h-10 bg-secondary-foreground rounded-full flex items-center justify-center w-10"
                onClick={() => {
                  clearCart();
                  toast.success("Cart cleared");
                }}
              >
                <X className="h-5 w-5 text-white" />
              </Button>

              <Button
                variant="custom"
                className="h-10 bg-secondary-foreground text-white text-sm font-semibold rounded-full shadow-lg flex-1 md:w-1/2 md:flex-none"
                size="sm"
                asChild
              >
                <Link
                  to={
                    tableId
                      ? `/menu/${shopId}/cart?table_id=${tableId}`
                      : `/menu/${shopId}/cart`
                  }
                  className="flex items-center justify-center"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  View Cart ({totalItems}) – ${total.toFixed(2)}
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
    </WiFiGate>
  );
};

export default WebMenu;

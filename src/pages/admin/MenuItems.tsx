import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Filter, Search, Edit, Trash2, ImageIcon, ChevronUp, ChevronDown } from 'lucide-react';
import ImageUpload from '@/components/admin/ImageUpload';
import ItemOptionsEditor, { ItemOptions } from '@/components/admin/ItemOptionsEditor';
import SizePricingEditor, { SizeOption } from '@/components/admin/SizePricingEditor';
import { Json } from '@/integrations/supabase/types';
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Category {
  id: string;
  name: string;
  display_order: number;
  restaurant_id: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  category_id: string;
  is_available: boolean;
  image_url?: string;
  options?: ItemOptions | null;
  size_enabled: boolean;
  sizes?: SizeOption[] | null;
  category?: Category;
}

// Get display price: for size-based items, use default size price
const getDisplayPrice = (item: MenuItem): number => {
  if (item.size_enabled && item.sizes && item.sizes.length > 0) {
    const defaultSize = item.sizes.find(s => s.default);
    return defaultSize ? defaultSize.price : item.sizes[0].price;
  }
  return item.price_usd;
};

const MenuItems = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState<'name' | 'price_usd' | 'category' | 'is_available' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Form state
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemOptions, setItemOptions] = useState<ItemOptions | null>(null);
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null);
  const [itemSizeEnabled, setItemSizeEnabled] = useState(false);
  const [itemSizes, setItemSizes] = useState<SizeOption[] | null>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch restaurant
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!restaurant) return;

      setRestaurantId(restaurant.id);

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('display_order');

      // Fetch menu items with proper category join - newest first
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select(`
          *,
          category:menu_categories(id, name, display_order)
        `)
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      setCategories(categoriesData || []);
      setMenuItems((itemsData || []).map(item => ({
        ...item,
        options: (item.options as unknown as ItemOptions) || null,
        sizes: (item.sizes as unknown as SizeOption[]) || null,
        category: Array.isArray(item.category) ? item.category[0] : item.category
      })));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Subscribe to realtime updates for menu items and categories
  useEffect(() => {
    if (!restaurantId) return;

    const menuItemsChannel = supabase
      .channel('admin-menu-items-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('Menu item change:', payload.eventType);
          fetchData();
        }
      )
      .subscribe();

    const categoriesChannel = supabase
      .channel('admin-menu-categories-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_categories',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('Category change:', payload.eventType);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(menuItemsChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, [restaurantId]);

  const resetForm = () => {
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemCategory('');
    setItemAvailable(true);
    setItemImageUrl(null);
    setItemOptions(null);
    setItemSizeEnabled(false);
    setItemSizes(null);
    setEditingItem(null);
  };

  const handleSaveItem = async () => {
    if (!user || !itemName || !itemCategory) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate pricing mode
    if (itemSizeEnabled) {
      // Size-based pricing validation
      if (!itemSizes || itemSizes.length === 0) {
        toast({
          title: "Invalid Configuration",
          description: "Size-based items must have at least one size",
          variant: "destructive",
        });
        return;
      }
      // Check all sizes have labels and valid prices
      for (const size of itemSizes) {
        if (!size.label.trim()) {
          toast({
            title: "Invalid Configuration",
            description: "All sizes must have a label",
            variant: "destructive",
          });
          return;
        }
        if (size.price < 0) {
          toast({
            title: "Invalid Configuration",
            description: "Size prices must be 0 or greater",
            variant: "destructive",
          });
          return;
        }
      }
      // Ensure exactly one default
      const defaultCount = itemSizes.filter(s => s.default).length;
      if (defaultCount !== 1) {
        toast({
          title: "Invalid Configuration",
          description: "Exactly one size must be set as default",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Fixed price validation
      if (!itemPrice || parseFloat(itemPrice) < 0) {
        toast({
          title: "Missing Information",
          description: "Fixed price items must have a valid base price",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate options if present
    if (itemOptions?.options) {
      for (const group of itemOptions.options) {
        if (!group.name.trim()) {
          toast({
            title: "Invalid Options",
            description: "All option groups must have a name",
            variant: "destructive",
          });
          return;
        }
        if (group.required && group.values.length === 0) {
          toast({
            title: "Invalid Options",
            description: `Required option group "${group.name}" must have at least one value`,
            variant: "destructive",
          });
          return;
        }
        for (const value of group.values) {
          if (!value.label.trim()) {
            toast({
              title: "Invalid Options",
              description: `All option values in "${group.name}" must have a label`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }

    if (!restaurantId) return;

    const itemData = {
      name: itemName,
      description: itemDescription || null,
      price_usd: itemSizeEnabled ? 0 : parseFloat(itemPrice),
      category_id: itemCategory,
      is_available: itemAvailable,
      image_url: itemImageUrl,
      options: itemOptions as unknown as Json,
      size_enabled: itemSizeEnabled,
      sizes: itemSizeEnabled ? (itemSizes as unknown as Json) : null,
      restaurant_id: restaurantId,
    };

    let error;

    if (editingItem) {
      ({ error } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', editingItem.id));
    } else {
      ({ error } = await supabase
        .from('menu_items')
        .insert(itemData));
    }

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Menu item ${editingItem ? 'updated' : 'added'} successfully`,
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDescription(item.description || '');
    setItemPrice(item.price_usd.toString());
    setItemCategory(item.category_id);
    setItemAvailable(item.is_available);
    setItemImageUrl(item.image_url || null);
    setItemOptions(item.options || null);
    setItemSizeEnabled(item.size_enabled || false);
    setItemSizes(item.sizes || null);
    setDialogOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Menu item deleted successfully",
      });
      fetchData();
    }
  };

  // Filter, search, sort and paginate items
  const filteredAndPaginatedItems = useMemo(() => {
    let filtered = menuItems;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category_id === selectedCategory);
    }

    // Apply availability filter
    if (selectedAvailability !== 'all') {
      const isAvailable = selectedAvailability === 'available';
      filtered = filtered.filter(item => item.is_available === isAvailable);
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'price_usd':
            aValue = a.price_usd;
            bValue = b.price_usd;
            break;
          case 'category':
            aValue = a.category?.name?.toLowerCase() || '';
            bValue = b.category?.name?.toLowerCase() || '';
            break;
          case 'is_available':
            aValue = a.is_available ? 1 : 0;
            bValue = b.is_available ? 1 : 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Calculate pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      totalItems,
      totalPages,
      startIndex: startIndex + 1,
      endIndex,
      currentPage,
    };
  }, [menuItems, selectedCategory, selectedAvailability, searchQuery, sortField, sortDirection, currentPage, itemsPerPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedAvailability, searchQuery]);

  // Handle sorting
  const handleSort = (field: 'name' | 'price_usd' | 'category' | 'is_available') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'name' | 'price_usd' | 'category' | 'is_available') => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="h-4 w-4 ml-1" /> :
      <ChevronDown className="h-4 w-4 ml-1" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">{/* Sticky Header with filters and controls */}
      {/* Sticky Header with filters and controls */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Menu Items</h2>
              <p className="text-sm text-muted-foreground">
                Showing {filteredAndPaginatedItems.totalItems > 0 ? filteredAndPaginatedItems.startIndex : 0}–{filteredAndPaginatedItems.endIndex} of {filteredAndPaginatedItems.totalItems} items
              </p>
            </div>

            {/* Controls: Search, Filters and Add Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filters:</span>
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Availability Filter */}
              <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-full sm:w-[260px]">
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

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Menu Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <ImageUpload
                      currentImageUrl={itemImageUrl}
                      onImageChange={setItemImageUrl}
                      restaurantId={restaurantId}
                    />

                    <div className="grid gap-2">
                      <Label htmlFor="name">Item Name *</Label>
                      <Input
                        id="name"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="e.g. Grilled Salmon"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        placeholder="Describe the dish, ingredients, and preparation..."
                        rows={3}
                      />
                    </div>

                    {/* Pricing Mode Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Pricing Mode</Label>
                        <RadioGroup
                          value={itemSizeEnabled ? 'size' : 'fixed'}
                          onValueChange={(val) => {
                            const sizeMode = val === 'size';
                            setItemSizeEnabled(sizeMode);
                            if (sizeMode && (!itemSizes || itemSizes.length === 0)) {
                              // Initialize with one default size
                              setItemSizes([{ label: '', price: 0, default: true }]);
                            }
                          }}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fixed" id="pricing-fixed" />
                            <Label htmlFor="pricing-fixed" className="text-sm font-normal cursor-pointer">
                              Fixed Price
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="size" id="pricing-size" />
                            <Label htmlFor="pricing-size" className="text-sm font-normal cursor-pointer">
                              Size-Based Price
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {!itemSizeEnabled ? (
                        <div className="grid gap-2">
                          <Label htmlFor="price">Base Price (USD) *</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            value={itemPrice}
                            onChange={(e) => setItemPrice(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <SizePricingEditor
                          sizes={itemSizes}
                          onChange={setItemSizes}
                        />
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select value={itemCategory} onValueChange={setItemCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Item Options Section */}
                    <div className="border-t pt-4 mt-4">
                      <ItemOptionsEditor
                        value={itemOptions}
                        onChange={setItemOptions}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="available"
                        checked={itemAvailable}
                        onCheckedChange={setItemAvailable}
                      />
                      <Label htmlFor="available">Available for ordering</Label>
                    </div>

                    <Button onClick={handleSaveItem} className="w-full" size="lg">
                      {editingItem ? 'Update Item' : 'Add Item'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Table */}
      {filteredAndPaginatedItems.totalItems === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              {menuItems.length === 0
                ? "No menu items yet. Add your first menu item to get started."
                : "No items match your current filters. Try adjusting the filters above."
              }
            </p>
            {menuItems.length === 0 && (
              <Button
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Menu Item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <TooltipProvider>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none w-[200px]"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[200px] hidden md:table-cell">Description</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none w-[100px] text-right"
                    onClick={() => handleSort('price_usd')}
                  >
                    <div className="flex items-center justify-end">
                      Price
                      {getSortIcon('price_usd')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none w-[120px] hidden sm:table-cell"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center">
                      Category
                      {getSortIcon('category')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none w-[100px]"
                    onClick={() => handleSort('is_available')}
                  >
                    <div className="flex items-center">
                      Status
                      {getSortIcon('is_available')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndPaginatedItems.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="w-[80px]">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted/20 rounded-lg border flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium min-w-[120px]">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[200px]">{item.name}</span>
                        {/* Show description on mobile as secondary text */}
                        <span className="text-sm text-muted-foreground md:hidden truncate max-w-[200px]">
                          {item.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[200px] hidden md:table-cell">
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {item.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="w-[100px] text-right font-medium">
                      ${getDisplayPrice(item).toFixed(2)}
                    </TableCell>
                    <TableCell className="w-[120px] hidden sm:table-cell">
                      {item.category ? (
                        <Badge variant="secondary" className="text-xs">
                          {item.category.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="w-[100px]">
                      <Badge
                        variant={item.is_available ? "default" : "secondary"}
                        className={item.is_available ? "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/20 dark:text-green-400" : ""}
                      >
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[100px] text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit item</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setItemToDelete(item);
                                setConfirmOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete item</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}

      {/* Pagination */}
      {filteredAndPaginatedItems.totalPages > 1 && (

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
          <div className="text-sm text-muted-foreground">
            Page {filteredAndPaginatedItems.currentPage} of {filteredAndPaginatedItems.totalPages}
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                  }}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {Array.from({ length: filteredAndPaginatedItems.totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current
                  return page === 1 ||
                    page === filteredAndPaginatedItems.totalPages ||
                    Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  // Add ellipsis if there's a gap
                  const shouldShowEllipsis = index > 0 && page - array[index - 1] > 1;

                  return (
                    <div key={page} className="flex items-center">
                      {shouldShowEllipsis && (
                        <PaginationItem>
                          <span className="px-3 py-2 text-muted-foreground">...</span>
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  );
                })}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < filteredAndPaginatedItems.totalPages) {
                      setCurrentPage(currentPage + 1);
                    }
                  }}
                  className={currentPage >= filteredAndPaginatedItems.totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Confirm Dialog for Deleting Item */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete item \"${itemToDelete?.name || ''}\"?`}
        description={itemToDelete ? 'This action will permanently delete the item.' : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          if (!itemToDelete) return
          handleDeleteItem(itemToDelete.id)
          setConfirmOpen(false)
          setItemToDelete(null)
        }}
        onCancel={() => {
          setItemToDelete(null)
          setConfirmOpen(false)
        }}
      />
    </div>
  );
};

export default MenuItems;
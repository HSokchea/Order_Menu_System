import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CategoryManager from '@/components/admin/CategoryManager';
import ImageUpload from '@/components/admin/ImageUpload';
import MenuItemCard from '@/components/admin/MenuItemCard';

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  category_id: string;
  is_available: boolean;
  image_url?: string;
  category?: Category;
}

const MenuManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [restaurantId, setRestaurantId] = useState<string>('');

  // Form state
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null);

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

      // Fetch menu items with proper category join
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select(`
          *,
          category:menu_categories(id, name, display_order)
        `)
        .eq('restaurant_id', restaurant.id)
        .order('name');

      setCategories(categoriesData || []);
      setMenuItems((itemsData || []).map(item => ({
        ...item,
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

  const resetForm = () => {
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemCategory('');
    setItemAvailable(true);
    setItemImageUrl(null);
    setEditingItem(null);
  };

  const handleSaveItem = async () => {
    if (!user || !itemName || !itemPrice || !itemCategory) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!restaurantId) return;

    const itemData = {
      name: itemName,
      description: itemDescription || null,
      price_usd: parseFloat(itemPrice),
      category_id: itemCategory,
      is_available: itemAvailable,
      image_url: itemImageUrl,
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

  const handleMenuItemDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(menuItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for better UX
    setMenuItems(items);

    // You could implement display_order updates here if needed
    // This would require adding a display_order column to menu_items table
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Menu Management</h1>
            <p className="text-muted-foreground">Manage your menu categories and items</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Category Management */}
        <CategoryManager
          categories={categories}
          restaurantId={restaurantId}
          onCategoriesUpdate={fetchData}
        />

        {/* Menu Items Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Menu Items</h2>
              <p className="text-sm text-muted-foreground">
                {menuItems.length} items • Drag to reorder
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
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
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Price (USD) *</Label>
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

          {/* Menu Items List */}
          {menuItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-center">
                  No menu items yet.<br />
                  Add your first menu item to get started.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(true)}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Menu Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DragDropContext onDragEnd={handleMenuItemDragEnd}>
              <Droppable droppableId="menu-items">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {menuItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                          >
                            <MenuItemCard
                              item={item}
                              onEdit={handleEditItem}
                              onDelete={handleDeleteItem}
                              dragProps={provided}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </main>
    </div>
  );
};

export default MenuManagement;
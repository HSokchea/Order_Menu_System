import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface CategoryManagerProps {
  categories: Category[];
  restaurantId: string;
  onCategoriesUpdate: () => void;
}

const CategoryManager = ({ categories, restaurantId, onCategoriesUpdate }: CategoryManagerProps) => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  const resetForm = () => {
    setCategoryName('');
    setEditingCategory(null);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a category name",
        variant: "destructive",
      });
      return;
    }

    const categoryData = {
      name: categoryName,
      restaurant_id: restaurantId,
      display_order: editingCategory ? editingCategory.display_order : categories.length,
    };

    let error;

    if (editingCategory) {
      ({ error } = await supabase
        .from('menu_categories')
        .update(categoryData)
        .eq('id', editingCategory.id));
    } else {
      ({ error } = await supabase
        .from('menu_categories')
        .insert(categoryData));
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
        description: `Category ${editingCategory ? 'updated' : 'added'} successfully`,
      });
      setDialogOpen(false);
      resetForm();
      onCategoriesUpdate();
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setDialogOpen(true);
  };

  const handleDeleteCategory = async (id: string) => {
    // Check if category has menu items
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id')
      .eq('category_id', id);

    if (menuItems && menuItems.length > 0) {
      toast({
        title: "Cannot Delete",
        description: "This category contains menu items. Please move or delete the items first.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('menu_categories')
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
        description: "Category deleted successfully",
      });
      onCategoriesUpdate();
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update display orders
    const updates = items.map((item, index) => ({
      id: item.id,
      display_order: index,
    }));

    for (const update of updates) {
      await supabase
        .from('menu_categories')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
    }

    onCategoriesUpdate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Categories</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input
                    id="categoryName"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g. Appetizers, Main Courses"
                  />
                </div>
                <Button onClick={handleSaveCategory} className="w-full">
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {categories.map((category, index) => (
                  <Draggable key={category.id} draggableId={category.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border"
                      >
                        <div {...provided.dragHandleProps}>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="flex-1 font-medium">{category.name}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </CardContent>
    </Card>
  );
};

export default CategoryManager;
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, X } from 'lucide-react';

interface CategoryControlsProps {
  restaurantId: string;
  onCategoriesUpdate: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  editingCategory?: any;
  onEditComplete?: () => void;
}

const CategoryControls = ({
  restaurantId,
  onCategoriesUpdate,
  searchQuery = '',
  onSearchChange,
  editingCategory,
  onEditComplete
}: CategoryControlsProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryStatus, setCategoryStatus] = useState('active');
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Handle external editing category
  useEffect(() => {
    if (editingCategory) {
      setCategoryName(editingCategory.name);
      setCategoryDescription(editingCategory.description || '');
      setCategoryStatus(editingCategory.status);
      setDialogOpen(true);
    }
  }, [editingCategory]);

  const resetForm = () => {
    setCategoryName('');
    setCategoryDescription('');
    setCategoryStatus('active');
    if (onEditComplete) {
      onEditComplete();
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    const categoryData = {
      name: categoryName,
      description: categoryDescription || null,
      status: categoryStatus,
      restaurant_id: restaurantId,
      display_order: 0, // Will be handled by the backend
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
      toast.error(error.message);
    } else {
      toast.success(`Category ${editingCategory ? 'updated' : 'added'} successfully`);
      setDialogOpen(false);
      resetForm();
      // Realtime subscription will handle the update automatically
    }
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  return (
    <>
     {/* Search */}
      <div className="relative w-full sm:w-[260px]">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => document.getElementById('search-input')?.focus()}
        />
        <Input
          id="search-input"
          placeholder="Search categories..."
          value={localSearchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-8"
        />
        {localSearchQuery && (
          <button
            onClick={() => handleSearchChange('')}
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
            <div className="grid gap-2">
              <Label htmlFor="categoryDescription">Description (Optional)</Label>
              <Textarea
                id="categoryDescription"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Brief description of this category"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoryStatus">Status</Label>
              <Select value={categoryStatus} onValueChange={setCategoryStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveCategory} className="w-full">
              {editingCategory ? 'Update Category' : 'Add Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryControls;
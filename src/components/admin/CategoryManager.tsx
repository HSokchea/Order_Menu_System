import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, GripVertical, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface Category {
  id: string;
  name: string;
  description?: string;
  status: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  restaurant_id: string;
}

interface CategoryManagerProps {
  categories: Category[];
  restaurantId: string;
  onCategoriesUpdate: () => void;
  showControls?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const CategoryManager = ({
  categories,
  restaurantId,
  onCategoriesUpdate,
  showControls = true,
  searchQuery: externalSearchQuery = '',
  onSearchChange
}: CategoryManagerProps) => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryStatus, setCategoryStatus] = useState('active');

  // Search and sorting state
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery);
  const [sortField, setSortField] = useState<'name' | 'item_count' | 'status' | 'updated_at' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSearch, setShowSearch] = useState(false);

  // Use external search query if provided
  const activeSearchQuery = onSearchChange ? externalSearchQuery : searchQuery;

  // Get item counts for each category
  const categoriesWithItemCounts = useMemo(async () => {
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const { count } = await supabase
          .from('menu_items')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id);
        return { ...category, item_count: count || 0 };
      })
    );
    return categoriesWithCounts;
  }, [categories]);

  const resetForm = () => {
    setCategoryName('');
    setCategoryDescription('');
    setCategoryStatus('active');
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
      description: categoryDescription || null,
      status: categoryStatus,
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
    setCategoryDescription(category.description || '');
    setCategoryStatus(category.status);
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

  // Sorting function
  const handleSort = (field: 'name' | 'item_count' | 'status' | 'updated_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort categories
  const filteredAndSortedCategories = useMemo(() => {
    let filtered = categories.filter(category => {
      const matchesSearch = !activeSearchQuery ||
        category.name.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(activeSearchQuery.toLowerCase()));
      return matchesSearch;
    });

    if (sortField) {
      filtered.sort((a, b) => {
        let aValue, bValue;
        switch (sortField) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'updated_at':
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [categories, activeSearchQuery, sortField, sortDirection]);

  return (
    <div className="space-y-4">
      <TooltipProvider>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="text-center">Item Count</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 text-center"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Status
                    {sortField === 'status' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 hidden lg:table-cell"
                  onClick={() => handleSort('updated_at')}
                >
                  <div className="flex items-center gap-2">
                    Last Updated
                    {sortField === 'updated_at' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="categories">
                {(provided) => (
                  <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                    {filteredAndSortedCategories.map((category, index) => {
                      // Get item count for this category
                      const getItemCount = async (categoryId: string) => {
                        const { count } = await supabase
                          .from('menu_items')
                          .select('*', { count: 'exact', head: true })
                          .eq('category_id', categoryId);
                        return count || 0;
                      };

                      return (
                        <Draggable key={category.id} draggableId={category.id} index={index}>
                          {(provided, snapshot) => (
                            <TableRow
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? "bg-muted/50" : ""}
                            >
                              <TableCell>
                                <div {...provided.dragHandleProps} className="cursor-grab">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{category.name}</TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {category.description || '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <ItemCountCell categoryId={category.id} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={category.status === 'active' ? 'default' : 'secondary'}>
                                  {category.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-muted-foreground">
                                {new Date(category.updated_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditCategory(category)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit category</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteCategory(category.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive hover:text-destructive" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete category</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </TableBody>
                )}
              </Droppable>
            </DragDropContext>
          </Table>
        </div>
      </TooltipProvider>
    </div>
  );
};

// Helper component to fetch and display item count
const ItemCountCell = ({ categoryId }: { categoryId: string }) => {
  const [itemCount, setItemCount] = useState<number>(0);

  useEffect(() => {
    const fetchItemCount = async () => {
      const { count } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId);
      setItemCount(count || 0);
    };
    fetchItemCount();
  }, [categoryId]);

  return <span className="text-muted-foreground">{itemCount} items</span>;
};

export default CategoryManager;
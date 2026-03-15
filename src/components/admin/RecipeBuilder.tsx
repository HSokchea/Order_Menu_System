import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useIngredients } from '@/hooks/useInventory';
import { useMenuItemSizes } from '@/hooks/useMenuItemSizes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecipeIngredient {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity: number;
  size_id: string | null;
  ingredient?: { name: string; unit: string };
}

interface RecipeBuilderProps {
  menuItemId: string;
  sizeEnabled?: boolean;
}

export const RecipeBuilder = ({ menuItemId, sizeEnabled = false }: RecipeBuilderProps) => {
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const { ingredients } = useIngredients();
  const { sizes } = useMenuItemSizes(menuItemId);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [activeSizeTab, setActiveSizeTab] = useState<string>('base');

  const fetchRecipe = useCallback(async () => {
    if (!menuItemId) { setRecipe([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_item_ingredients')
      .select('*, ingredient:ingredients(*)')
      .eq('menu_item_id', menuItemId);

    if (!error && data) {
      setRecipe(data.map((r: any) => ({
        ...r,
        ingredient: Array.isArray(r.ingredient) ? r.ingredient[0] : r.ingredient
      })));
    }
    setLoading(false);
  }, [menuItemId]);

  useEffect(() => { fetchRecipe(); }, [fetchRecipe]);

  // Set active tab to first size when sizes change
  useEffect(() => {
    if (sizeEnabled && sizes.length > 0 && activeSizeTab === 'base') {
      setActiveSizeTab(sizes[0].id);
    }
  }, [sizes, sizeEnabled]);

  const handleAdd = async (sizeId: string | null = null) => {
    if (!selectedIngredientId || !quantity || parseFloat(quantity) <= 0) {
      toast.error('Select an ingredient and enter a valid quantity');
      return;
    }

    // Check for duplicate
    const duplicate = recipe.find(r =>
      r.ingredient_id === selectedIngredientId &&
      r.size_id === sizeId
    );
    if (duplicate) {
      toast.error('This ingredient is already in the recipe for this size');
      return;
    }

    const insertData: any = {
      menu_item_id: menuItemId,
      ingredient_id: selectedIngredientId,
      quantity: parseFloat(quantity),
    };
    if (sizeId) insertData.size_id = sizeId;

    const { error } = await supabase.from('menu_item_ingredients').insert(insertData);
    if (error) { toast.error(error.message); return; }
    setSelectedIngredientId('');
    setQuantity('');
    await fetchRecipe();
  };

  const handleUpdate = async (id: string, qty: number) => {
    if (qty <= 0) return;
    const { error } = await supabase.from('menu_item_ingredients').update({ quantity: qty }).eq('id', id);
    if (error) toast.error(error.message);
    else await fetchRecipe();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('menu_item_ingredients').delete().eq('id', id);
    if (error) toast.error(error.message);
    else await fetchRecipe();
  };

  const getRecipeForSize = (sizeId: string | null) => {
    return recipe.filter(r => r.size_id === sizeId);
  };

  const getAvailableIngredients = (sizeId: string | null) => {
    const existing = getRecipeForSize(sizeId);
    return ingredients.filter(
      i => i.is_active && !existing.some(r => r.ingredient_id === i.id)
    );
  };

  if (loading) return <div className="text-sm text-muted-foreground py-2">Loading recipe...</div>;

  const RecipeTable = ({ sizeId }: { sizeId: string | null }) => {
    const sizeRecipe = getRecipeForSize(sizeId);
    const available = getAvailableIngredients(sizeId);

    return (
      <div className="space-y-3">
        {sizeRecipe.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sizeRecipe.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.ingredient?.name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-20 text-right h-8 ml-auto"
                        defaultValue={r.quantity}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val > 0 && val !== r.quantity) {
                            handleUpdate(r.id, val);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.ingredient?.unit || ''}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => handleRemove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {sizeRecipe.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No ingredients configured. Inventory will not be deducted.</p>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select ingredient" />
              </SelectTrigger>
              <SelectContent>
                {available.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-9"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => handleAdd(sizeId)} className="h-9">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Size-based mode: show tabs for each size
  if (sizeEnabled && sizes.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-base font-medium">Recipe Ingredients</Label>
          <Badge variant="secondary" className="text-xs">Per Size</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure ingredient quantities for each size. Stock is auto-deducted based on the size ordered.
        </p>

        <Tabs value={activeSizeTab} onValueChange={setActiveSizeTab}>
          <TabsList className="w-full justify-start">
            {sizes.map(size => (
              <TabsTrigger key={size.id} value={size.id} className="text-xs">
                {size.name}
                {getRecipeForSize(size.id).length > 0 && (
                  <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                    {getRecipeForSize(size.id).length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {sizes.map(size => (
            <TabsContent key={size.id} value={size.id}>
              <RecipeTable sizeId={size.id} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // Fixed price mode: single recipe table
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Recipe Ingredients</Label>
      <p className="text-xs text-muted-foreground">Define ingredients used when this item is ordered. Stock will be auto-deducted.</p>
      <RecipeTable sizeId={null} />
    </div>
  );
};

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { useMenuItemRecipe, useIngredients, type Ingredient } from '@/hooks/useInventory';
import { toast } from 'sonner';

interface RecipeBuilderProps {
  menuItemId: string;
}

export const RecipeBuilder = ({ menuItemId }: RecipeBuilderProps) => {
  const { recipe, loading, addRecipeIngredient, updateRecipeIngredient, removeRecipeIngredient } = useMenuItemRecipe(menuItemId);
  const { ingredients } = useIngredients();
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');

  const availableIngredients = ingredients.filter(
    i => i.is_active && !recipe.some(r => r.ingredient_id === i.id)
  );

  const handleAdd = async () => {
    if (!selectedIngredientId || !quantity || parseFloat(quantity) <= 0) {
      toast.error('Select an ingredient and enter a valid quantity');
      return;
    }
    const success = await addRecipeIngredient(selectedIngredientId, parseFloat(quantity));
    if (success) {
      setSelectedIngredientId('');
      setQuantity('');
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground py-2">Loading recipe...</div>;

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Recipe Ingredients</Label>
      <p className="text-xs text-muted-foreground">Define ingredients used when this item is ordered. Stock will be auto-deducted.</p>

      {recipe.length > 0 && (
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
              {recipe.map((r) => (
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
                          updateRecipeIngredient(r.id, val);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.ingredient?.unit || ''}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeRecipeIngredient(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add ingredient row */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select value={selectedIngredientId} onValueChange={setSelectedIngredientId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select ingredient" />
            </SelectTrigger>
            <SelectContent>
              {availableIngredients.map(i => (
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
        <Button size="sm" variant="outline" onClick={handleAdd} className="h-9">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

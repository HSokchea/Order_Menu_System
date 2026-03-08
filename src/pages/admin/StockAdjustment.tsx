import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useIngredients } from '@/hooks/useInventory';
import { PackagePlus, PackageMinus } from 'lucide-react';

const StockAdjustment = () => {
  const { ingredients, loading, adjustStock } = useIngredients();
  const [ingredientId, setIngredientId] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [transactionType, setTransactionType] = useState<'purchase' | 'adjustment' | 'waste'>('purchase');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedIngredient = ingredients.find(i => i.id === ingredientId);

  const handleSubmit = async () => {
    if (!ingredientId || !quantity || parseFloat(quantity) <= 0) return;
    setSubmitting(true);

    const qty = parseFloat(quantity);
    const actualQty = adjustType === 'remove' ? -qty : qty;

    const success = await adjustStock(ingredientId, actualQty, transactionType, note || undefined);
    if (success) {
      setQuantity('');
      setNote('');
      setIngredientId('');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Stock Adjustment</h2>
        <p className="text-sm text-muted-foreground">Add or remove stock and record the reason</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">New Adjustment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Ingredient *</Label>
            <Select value={ingredientId} onValueChange={setIngredientId}>
              <SelectTrigger><SelectValue placeholder="Select ingredient" /></SelectTrigger>
              <SelectContent>
                {ingredients.filter(i => i.is_active).map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({i.current_stock} {i.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Adjustment Direction</Label>
            <RadioGroup value={adjustType} onValueChange={(v) => setAdjustType(v as 'add' | 'remove')} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add" id="adj-add" />
                <Label htmlFor="adj-add" className="flex items-center gap-1 cursor-pointer">
                  <PackagePlus className="h-4 w-4 text-green-600" /> Add Stock
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="remove" id="adj-remove" />
                <Label htmlFor="adj-remove" className="flex items-center gap-1 cursor-pointer">
                  <PackageMinus className="h-4 w-4 text-destructive" /> Remove Stock
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={transactionType} onValueChange={(v) => setTransactionType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="waste">Waste</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Quantity * {selectedIngredient ? `(${selectedIngredient.unit})` : ''}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="grid gap-2">
            <Label>Note / Reason</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Supplier delivery, broken bag..."
              rows={2}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={submitting || !ingredientId || !quantity}>
            {submitting ? 'Saving...' : 'Submit Adjustment'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockAdjustment;

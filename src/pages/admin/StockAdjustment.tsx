import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useIngredients, Ingredient } from '@/hooks/useInventory';
import { Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, PackagePlus, PackageMinus, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

type AdjustType = 'purchase' | 'waste' | 'adjustment';

const TYPE_OPTIONS: { value: AdjustType; label: string; icon: typeof PackagePlus }[] = [
  { value: 'purchase', label: 'Purchase', icon: PackagePlus },
  { value: 'waste', label: 'Waste', icon: PackageMinus },
  { value: 'adjustment', label: 'Correction', icon: Settings2 },
];

interface AdjustmentRow {
  id: string;
  ingredientId: string;
  change: string;
}

const StockAdjustment = () => {
  const { ingredients, loading, adjustStock } = useIngredients();
  const [rows, setRows] = useState<AdjustmentRow[]>([createRow()]);
  const [adjustType, setAdjustType] = useState<AdjustType>('adjustment');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function createRow(): AdjustmentRow {
    return { id: crypto.randomUUID(), ingredientId: '', change: '' };
  }

  const activeIngredients = ingredients.filter(i => i.is_active);
  const usedIngredientIds = rows.map(r => r.ingredientId).filter(Boolean);
  const getIngredient = useCallback((id: string) => activeIngredients.find(i => i.id === id), [activeIngredients]);

  const updateRow = (rowId: string, field: keyof AdjustmentRow, value: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== rowId) : prev);
  };

  const addRow = () => setRows(prev => [...prev, createRow()]);

  const validRows = rows.filter(r => {
    if (!r.ingredientId || !r.change) return false;
    const change = parseFloat(r.change);
    if (isNaN(change) || change === 0) return false;
    const ing = getIngredient(r.ingredientId);
    if (!ing) return false;
    if (ing.current_stock + change < 0) return false;
    return true;
  });

  const canSubmit = validRows.length > 0 && reason.trim().length > 0;

  const handlePreview = () => { if (canSubmit) setShowPreview(true); };

  const handleSubmit = async () => {
    setShowPreview(false);
    setSubmitting(true);

    let successCount = 0;
    for (const row of validRows) {
      const change = parseFloat(row.change);
      const note = `${reason}${reference ? ` | Ref: ${reference}` : ''}`;
      const success = await adjustStock(row.ingredientId, change, adjustType, note);
      if (success) successCount++;
    }

    if (successCount > 0) {
      toast.success(`${successCount} ${adjustType} adjustment(s) applied`);
      setRows([createRow()]);
      setReason('');
      setReference('');
    }
    setSubmitting(false);
  };

  const typeLabel = TYPE_OPTIONS.find(t => t.value === adjustType)?.label ?? 'Adjustment';

  if (loading) return <div className="flex items-center justify-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Inventory Adjustment (Advanced)</h2>
        <p className="text-sm text-muted-foreground">Perform bulk adjustments and track inventory changes with full audit control</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bulk Adjustment</CardTitle>
          <CardDescription>Add multiple ingredients and adjust their stock levels at once</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adjustment Type Selector */}
          <div className="space-y-1.5">
            <Label className="text-sm">Adjustment Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(t => {
                const Icon = t.icon;
                const isActive = adjustType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={cn(
                      'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border',
                      isActive
                        ? t.value === 'purchase'
                          ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                          : t.value === 'waste'
                            ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400'
                            : 'bg-accent border-border text-accent-foreground'
                        : 'bg-background border-border text-muted-foreground hover:bg-accent/50'
                    )}
                    onClick={() => setAdjustType(t.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_100px_100px_100px_40px] gap-3 text-xs font-medium text-muted-foreground px-1">
            <span>Ingredient</span>
            <span>Current</span>
            <span>Change</span>
            <span>New Stock</span>
            <span></span>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {rows.map((row) => (
              <AdjustmentRowItem
                key={row.id}
                row={row}
                ingredients={activeIngredients}
                usedIds={usedIngredientIds}
                getIngredient={getIngredient}
                onUpdate={updateRow}
                onRemove={removeRow}
                canRemove={rows.length > 1}
              />
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Ingredient
          </Button>

          <div className="border-t pt-4 space-y-3">
            <div className="grid gap-2">
              <Label>Reason *</Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Monthly stock count, supplier delivery, correction"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="grid gap-2">
              <Label>Reference (optional)</Label>
              <Input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. Invoice #123, Manual check"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setRows([createRow()]); setReason(''); setReference(''); }}
            >
              Cancel
            </Button>
            <Button onClick={handlePreview} disabled={!canSubmit || submitting}>
              {submitting ? 'Applying...' : 'Apply Adjustment'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Confirmation */}
      <ConfirmDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        title="Confirm Bulk Adjustment"
        confirmLabel="Confirm & Apply"
        description={
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Type: <span className="font-medium text-foreground">{typeLabel}</span>
            </p>
            <div className="rounded-lg border divide-y max-h-60 overflow-auto">
              {validRows.map(row => {
                const ing = getIngredient(row.ingredientId);
                const change = parseFloat(row.change);
                const newStock = (ing?.current_stock ?? 0) + change;
                return (
                  <div key={row.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-medium">{ing?.name}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{ing?.current_stock} {ing?.unit}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={cn('font-medium', change > 0 ? 'text-green-600' : 'text-destructive')}>
                        {newStock} {ing?.unit}
                      </span>
                      <span className={cn('text-xs', change > 0 ? 'text-green-600' : 'text-destructive')}>
                        ({change > 0 ? '+' : ''}{change})
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Reason:</strong> {reason}
              {reference && <><br /><strong>Ref:</strong> {reference}</>}
            </div>
          </div>
        }
        onConfirm={handleSubmit}
      />
    </div>
  );
};

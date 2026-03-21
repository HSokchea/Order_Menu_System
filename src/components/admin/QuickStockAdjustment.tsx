import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, PackagePlus, PackageMinus, Settings2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Ingredient } from '@/hooks/useInventory';
import { toast } from 'sonner';

interface QuickStockAdjustmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  onAdjust: (ingredientId: string, quantity: number, type: 'purchase' | 'adjustment' | 'waste', note?: string) => Promise<boolean>;
}

type AdjustType = 'purchase' | 'waste' | 'adjustment';

const TYPE_CONFIG: { value: AdjustType; label: string; icon: typeof PackagePlus; key: string }[] = [
  { value: 'purchase', label: 'Purchase', icon: PackagePlus, key: '1' },
  { value: 'waste', label: 'Waste', icon: PackageMinus, key: '2' },
  { value: 'adjustment', label: 'Correction', icon: Settings2, key: '3' },
];

const QuickStockAdjustment = ({ open, onOpenChange, ingredients, onAdjust }: QuickStockAdjustmentProps) => {
  const [search, setSearch] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [adjustType, setAdjustType] = useState<AdjustType>('adjustment');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);

  const activeIngredients = ingredients.filter(i => i.is_active);
  const filtered = search.trim()
    ? activeIngredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : activeIngredients;

  const resetForm = useCallback(() => {
    setSearch('');
    setSelectedIngredient(null);
    setQuantity('1');
    setAdjustType('adjustment');
    setNote('');
    setHighlightIndex(0);
    setShowResults(false);
    setLastSaved(null);
  }, []);

  const resetForNext = useCallback(() => {
    setSearch('');
    setSelectedIngredient(null);
    setQuantity('1');
    setNote('');
    setHighlightIndex(0);
    setShowResults(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  // Auto-focus search on open
  useEffect(() => {
    if (open) {
      resetForm();
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open, resetForm]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  const selectIngredient = useCallback((ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setSearch(ingredient.name);
    setShowResults(false);
    setTimeout(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    }, 50);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedIngredient || !quantity || parseFloat(quantity) <= 0) return;
    setSubmitting(true);

    const qty = parseFloat(quantity);
    const actualQty = adjustType === 'waste' ? -qty : qty;

    const success = await onAdjust(selectedIngredient.id, actualQty, adjustType, note || undefined);
    if (success) {
      const direction = adjustType === 'waste' ? '-' : '+';
      setLastSaved(`${selectedIngredient.name} ${direction}${qty} ${selectedIngredient.unit}`);
      toast.success(`${selectedIngredient.name} ${direction}${qty} ${selectedIngredient.unit} applied`);
      resetForNext();
    }
    setSubmitting(false);
  }, [selectedIngredient, quantity, adjustType, note, onAdjust, resetForNext]);

  const adjustQuantity = useCallback((delta: number) => {
    setQuantity(prev => {
      const newVal = Math.max(0, (parseFloat(prev) || 0) + delta);
      return newVal.toString();
    });
  }, []);

  // Global keyboard handler for the modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Type selector shortcuts (only when not in note field)
    if (document.activeElement !== noteRef.current) {
      if (e.key === '1' && !selectedIngredient && !search) {
        e.preventDefault();
        setAdjustType('purchase');
        return;
      }
      if (e.key === '2' && !selectedIngredient && !search) {
        e.preventDefault();
        setAdjustType('waste');
        return;
      }
      if (e.key === '3' && !selectedIngredient && !search) {
        e.preventDefault();
        setAdjustType('adjustment');
        return;
      }
    }

    // Enter to save when ingredient is selected and quantity is valid
    if (e.key === 'Enter' && selectedIngredient && parseFloat(quantity) > 0) {
      if (document.activeElement === noteRef.current || document.activeElement === quantityRef.current) {
        e.preventDefault();
        handleSave();
        return;
      }
    }
  }, [selectedIngredient, quantity, search, handleSave]);

  // Search field keyboard handler
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowResults(true);
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0 && showResults) {
      e.preventDefault();
      e.stopPropagation();
      selectIngredient(filtered[highlightIndex]);
    } else if (e.key === 'Escape') {
      if (showResults) {
        setShowResults(false);
      }
    }
  }, [filtered, highlightIndex, showResults, selectIngredient]);

  // Quantity field keyboard handler
  const handleQuantityKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      adjustQuantity(e.shiftKey ? 10 : 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      adjustQuantity(e.shiftKey ? -10 : -1);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Let tab go to note
    }
  }, [adjustQuantity]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 rounded-2xl overflow-hidden"
        hideCloseButton
        onKeyDown={handleKeyDown}
      >
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">Quick Stock Adjust</DialogTitle>
            {lastSaved && (
              <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="h-3 w-3" />
                Saved
              </Badge>
            )}
          </div>

          {/* Ingredient Search */}
          <div className="relative">
            <Input
              ref={searchRef}
              placeholder="Search ingredient..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowResults(true);
                if (selectedIngredient && e.target.value !== selectedIngredient.name) {
                  setSelectedIngredient(null);
                }
              }}
              onFocus={() => { if (!selectedIngredient) setShowResults(true); }}
              onKeyDown={handleSearchKeyDown}
              className="h-10"
            />
            {showResults && !selectedIngredient && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filtered.map((ing, idx) => (
                  <button
                    key={ing.id}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors',
                      idx === highlightIndex && 'bg-accent',
                      idx === 0 && 'rounded-t-xl',
                      idx === filtered.length - 1 && 'rounded-b-xl'
                    )}
                    onMouseDown={(e) => { e.preventDefault(); selectIngredient(ing); }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                  >
                    <span className="font-medium">{ing.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {ing.current_stock} {ing.unit}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showResults && !selectedIngredient && search && filtered.length === 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg p-3 text-sm text-muted-foreground text-center">
                No ingredients found
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={() => adjustQuantity(-1)}
              disabled={!selectedIngredient}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex-1 relative">
              <Input
                ref={quantityRef}
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={handleQuantityKeyDown}
                className="h-10 text-center text-lg font-semibold pr-12"
                disabled={!selectedIngredient}
              />
              {selectedIngredient && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                  {selectedIngredient.unit}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={() => adjustQuantity(1)}
              disabled={!selectedIngredient}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_CONFIG.map((t) => {
              const Icon = t.icon;
              const isActive = adjustType === t.value;
              return (
                <button
                  key={t.value}
                  className={cn(
                    'flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-all border',
                    isActive
                      ? t.value === 'purchase'
                        ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                        : t.value === 'waste'
                          ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400'
                          : 'bg-accent border-border text-accent-foreground'
                      : 'bg-background border-border text-muted-foreground hover:bg-accent/50'
                  )}
                  onClick={() => setAdjustType(t.value)}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Note */}
          <Input
            ref={noteRef}
            placeholder="Reason (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 text-sm"
          />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1 h-10 rounded-xl"
              onClick={handleSave}
              disabled={submitting || !selectedIngredient || !quantity || parseFloat(quantity) <= 0}
            >
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {/* Keyboard hints */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground/60">
            <span>↑↓ Navigate</span>
            <span>Enter Select/Save</span>
            <span>Shift+↑↓ ±10</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickStockAdjustment;

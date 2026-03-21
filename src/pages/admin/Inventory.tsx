import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit, Search, AlertTriangle, Zap } from 'lucide-react';
import { useIngredients, Ingredient } from '@/hooks/useInventory';
import QuickStockAdjustment from '@/components/admin/QuickStockAdjustment';

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'oz', 'lb', 'cup', 'tbsp', 'tsp'];

const Inventory = () => {
  const { ingredients, loading, addIngredient, updateIngredient, adjustStock } = useIngredients();
  const [quickAdjustOpen, setQuickAdjustOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('g');
  const [currentStock, setCurrentStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setName(''); setUnit('g'); setCurrentStock(''); setMinStock('');
    setCostPerUnit(''); setIsActive(true); setEditingItem(null);
  };

  const handleEdit = (item: Ingredient) => {
    setEditingItem(item);
    setName(item.name);
    setUnit(item.unit);
    setCurrentStock(item.current_stock.toString());
    setMinStock(item.min_stock.toString());
    setCostPerUnit(item.cost_per_unit.toString());
    setIsActive(item.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      unit,
      current_stock: parseFloat(currentStock) || 0,
      min_stock: parseFloat(minStock) || 0,
      cost_per_unit: parseFloat(costPerUnit) || 0,
      is_active: isActive,
    };

    let success: boolean | undefined;
    if (editingItem) {
      success = await updateIngredient(editingItem.id, data);
    } else {
      success = await addIngredient(data);
    }

    if (success) {
      setDialogOpen(false);
      resetForm();
    }
  };

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickAdjustOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <p className="text-sm text-muted-foreground">{ingredients.length} ingredients</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button variant="outline" onClick={() => setQuickAdjustOpen(true)} className="gap-1.5">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Adjust</span>
            <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground ml-1">
              ⌘K
            </kbd>
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Milk" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Unit</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Cost per Unit ($)</Label>
                    <Input type="number" step="0.01" min="0" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Current Stock</Label>
                    <Input type="number" step="0.01" min="0" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} placeholder="0" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Min Stock (alert threshold)</Label>
                    <Input type="number" step="0.01" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Active</Label>
                </div>
                <Button onClick={handleSave} className="w-full">
                  {editingItem ? 'Update' : 'Add Ingredient'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {ingredients.length === 0 ? 'No ingredients yet. Add your first ingredient.' : 'No ingredients match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <TooltipProvider>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Min Stock</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Cost/Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const isLow = item.is_active && item.current_stock <= item.min_stock;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isLow && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-warning" />
                              </TooltipTrigger>
                              <TooltipContent>Low stock</TooltipContent>
                            </Tooltip>
                          )}
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${isLow ? 'text-destructive font-bold' : ''}`}>
                        {item.current_stock}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{item.min_stock}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">${item.cost_per_unit.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? 'default' : 'secondary'}
                          className={item.is_active ? 'bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/20 dark:text-green-400' : ''}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}

      <QuickStockAdjustment
        open={quickAdjustOpen}
        onOpenChange={setQuickAdjustOpen}
        ingredients={ingredients}
        onAdjust={adjustStock}
      />
    </div>
  );
};

export default Inventory;

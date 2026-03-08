import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIngredients } from '@/hooks/useInventory';

export const LowStockAlert = () => {
  const { lowStockIngredients, loading } = useIngredients();

  if (loading || lowStockIngredients.length === 0) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-warning">
          <AlertTriangle className="h-4 w-4" />
          Low Stock Warning ({lowStockIngredients.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {lowStockIngredients.map(i => (
            <div key={i.id} className="text-xs px-2 py-1 rounded bg-warning/10 text-warning-foreground border border-warning/20">
              {i.name}: {i.current_stock} {i.unit}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { useIngredients, useInventoryTransactions } from '@/hooks/useInventory';
import { format } from 'date-fns';

const TYPE_COLORS: Record<string, string> = {
  purchase: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  order: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  adjustment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  waste: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

const InventoryHistory = () => {
  const { restaurantId } = useIngredients();
  const { transactions, loading } = useInventoryTransactions(restaurantId);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    let result = transactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.ingredient?.name?.toLowerCase().includes(q) ||
        t.note?.toLowerCase().includes(q) ||
        t.reference_id?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }
    return result;
  }, [transactions, searchQuery, typeFilter]);

  if (loading) return <div className="flex items-center justify-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Inventory History</h2>
          <p className="text-sm text-muted-foreground">{transactions.length} transactions</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="waste">Waste</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No transactions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Ingredient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="hidden sm:table-cell">Reference</TableHead>
                <TableHead className="hidden md:table-cell">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(tx.created_at), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium">{tx.ingredient?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={TYPE_COLORS[tx.type] || ''}>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono ${tx.quantity > 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {tx.quantity > 0 ? '+' : ''}{tx.quantity} {tx.ingredient?.unit || ''}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {tx.reference_id || '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                    {tx.note || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default InventoryHistory;

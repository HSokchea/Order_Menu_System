import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, CalendarIcon, Download, TrendingUp, TrendingDown, AlertTriangle, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIngredients } from '@/hooks/useInventory';
import { useInventoryHistory, type DatePreset } from '@/hooks/useInventoryHistory';
import { exportInventoryHistory } from '@/lib/inventoryExport';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TYPE_COLORS: Record<string, string> = {
  purchase: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  order: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  adjustment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  waste: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  order_reversal: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
};

const DATE_PRESETS: { label: string; value: DatePreset | 'custom' }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'last7days' },
  { label: 'Last 30 Days', value: 'last30days' },
  { label: 'Custom Range', value: 'custom' },
];

const getDateLabel = (preset: DatePreset | 'custom', from?: Date, to?: Date) => {
  if (preset === 'custom' && from && to) {
    return `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`;
  }
  return DATE_PRESETS.find(p => p.value === preset)?.label || 'Today';
};

const InventoryHistory = () => {
  const { restaurantId, ingredients } = useIngredients();
  const { transactions, loading, refreshing, summary, filters, updateFilter, setPage, totalPages, totalCount, pageSize } = useInventoryHistory(restaurantId);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({});
  const [showCalendar, setShowCalendar] = useState(false);

  const handleDatePreset = (preset: DatePreset | 'custom') => {
    if (preset === 'custom') {
      setShowCalendar(true);
    } else {
      updateFilter({ datePreset: preset });
      setShowCalendar(false);
      setDatePopoverOpen(false);
      setTempRange({});
    }
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    setTempRange(range);
    if (range.from && range.to) {
      updateFilter({ datePreset: 'custom', customFrom: range.from, customTo: range.to });
      setShowCalendar(false);
      setDatePopoverOpen(false);
    }
  };

  const handleExport = (fmt: 'csv' | 'xlsx') => {
    const result = exportInventoryHistory(transactions, fmt);
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
  };

  if (loading && transactions.length === 0) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className={cn("space-y-4 transition-opacity duration-200", refreshing && "opacity-60 pointer-events-none")}>
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Inventory History</h2>
        <p className="text-sm text-muted-foreground">{totalCount} transactions</p>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <Popover open={datePopoverOpen} onOpenChange={(open) => {
          setDatePopoverOpen(open);
          if (!open) setShowCalendar(false);
        }}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-10 w-full sm:w-auto">
              <CalendarIcon className="h-4 w-4" />
              {getDateLabel(filters.datePreset, filters.customFrom, filters.customTo)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {!showCalendar ? (
              <div className="flex flex-col p-1 min-w-[160px]">
                {DATE_PRESETS.map(p => (
                  <Button
                    key={p.value}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'justify-start font-normal',
                      filters.datePreset === p.value && p.value !== 'custom' && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => handleDatePreset(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            ) : (
              <Calendar
                mode="range"
                defaultMonth={tempRange.from || new Date()}
                selected={tempRange as { from: Date; to: Date }}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                className="p-3 pointer-events-auto"
              />
            )}
          </PopoverContent>
        </Popover>

        <Select value={filters.ingredientId} onValueChange={(v) => updateFilter({ ingredientId: v })}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Ingredients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ingredients</SelectItem>
            {ingredients.filter(i => i.is_active).map(i => (
              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.direction} onValueChange={(v: any) => updateFilter({ direction: v })}>
          <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="All Directions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="in">Stock In (+)</SelectItem>
            <SelectItem value="out">Stock Out (−)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(v) => updateFilter({ type: v })}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="order">Order</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
            <SelectItem value="waste">Waste</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 w-full sm:w-auto min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ingredient, note, ref..."
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-10">
              <Download className="h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('csv')}>Export CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('xlsx')}>Export Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full p-2 bg-green-100 dark:bg-green-900/20">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total In</p>
              <p className="text-lg font-bold text-green-600">+{summary.totalIn.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full p-2 bg-red-100 dark:bg-red-900/20">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Out</p>
              <p className="text-lg font-bold text-destructive">{summary.totalOut.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full p-2 bg-yellow-100 dark:bg-yellow-900/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Waste</p>
              <p className="text-lg font-bold text-yellow-600">{summary.waste.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-full p-2 bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Change</p>
              <p className={cn('text-lg font-bold', summary.netChange >= 0 ? 'text-green-600' : 'text-destructive')}>
                {summary.netChange > 0 ? '+' : ''}{summary.netChange.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No inventory transactions found for selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <>
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
                {transactions.map((tx) => (
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {filters.page + 1} of {totalPages} ({totalCount} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 0}
                  onClick={() => setPage(filters.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= totalPages - 1}
                  onClick={() => setPage(filters.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InventoryHistory;

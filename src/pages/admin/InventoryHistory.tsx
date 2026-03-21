import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, CalendarIcon, Download, TrendingUp, TrendingDown, AlertTriangle, Activity, ChevronLeft, ChevronRight, ChevronDown, ClipboardList, Package, Wrench, Trash2, RotateCcw } from 'lucide-react';
import { useIngredients } from '@/hooks/useInventory';
import { InventoryTransactionDetail } from '@/components/admin/InventoryTransactionDetail';
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
  const [selectedTx, setSelectedTx] = useState<any>(null);

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

  const renderReference = (tx: any) => {
    const ref = tx.reference_id;
    const note = tx.note;

    switch (tx.type) {
      case 'order': {
        const shortId = ref ? ref.substring(0, 8).toUpperCase() : null;
        return shortId ? (
          <button
            onClick={() => navigate(`/admin/orders/${ref}`)}
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Order #{shortId}
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      }
      case 'order_reversal': {
        const shortId = ref ? ref.substring(0, 8).toUpperCase() : null;
        return shortId ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Reversal #{shortId}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Order Reversal
          </span>
        );
      }
      case 'purchase':
        return (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            {ref ? `Invoice #${ref}` : 'Stock Purchase'}
          </span>
        );
      case 'waste':
        return (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" />
            {'Waste'}
          </span>
        );
      case 'adjustment':
        return (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
            {'Manual Adjustment'}
          </span>
        );
      default:
        return <span className="text-muted-foreground">{ref || '—'}</span>;
    }
  };


  if (loading && transactions.length === 0) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className={cn("space-y-4 transition-opacity duration-200", refreshing && "opacity-60 pointer-events-none")}>
      {/* Header with Filters and Export */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Inventory History</h2>
            <p className="text-sm text-muted-foreground">{totalCount} transactions</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Popover open={datePopoverOpen} onOpenChange={(open) => {
              setDatePopoverOpen(open);
              if (!open) { setShowCalendar(false); setTempRange({}); }
            }}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 font-normal text-sm">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {getDateLabel(filters.datePreset, filters.customFrom, filters.customTo)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <div className="relative">
                  <div className="flex flex-col p-1 min-w-[150px]">
                    {DATE_PRESETS.map(p => (
                      <Button
                        key={p.value}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'justify-start font-normal text-sm',
                          p.value === 'custom'
                            ? showCalendar && 'bg-accent text-accent-foreground'
                            : filters.datePreset === p.value && !showCalendar && 'bg-accent text-accent-foreground'
                        )}
                        onClick={() => handleDatePreset(p.value)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  {showCalendar && (
                    <div className="absolute left-full top-[-1px] z-50 ml-1.5 border border-border rounded-xl bg-popover shadow-sm">
                      <Calendar
                        mode="range"
                        defaultMonth={tempRange.from || filters.customFrom || new Date()}
                        selected={tempRange.from ? tempRange as { from: Date; to: Date } : undefined}
                        onSelect={handleCalendarSelect}
                        numberOfMonths={2}
                        disabled={(date) => date > new Date()}
                        className="p-3 pointer-events-auto"
                      />
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 font-normal text-sm min-w-[140px] justify-between">
                  {filters.ingredientId === 'all'
                    ? 'All Ingredients'
                    : ingredients.find(i => i.id === filters.ingredientId)?.name || 'All Ingredients'}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1 min-w-[160px]" align="start">
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn('justify-start font-normal text-sm', filters.ingredientId === 'all' && 'bg-accent text-accent-foreground')}
                    onClick={() => updateFilter({ ingredientId: 'all' })}
                  >
                    All Ingredients
                  </Button>
                  {ingredients.filter(i => i.is_active).map(i => (
                    <Button
                      key={i.id}
                      variant="ghost"
                      size="sm"
                      className={cn('justify-start font-normal text-sm', filters.ingredientId === i.id && 'bg-accent text-accent-foreground')}
                      onClick={() => updateFilter({ ingredientId: i.id })}
                    >
                      {i.name}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 font-normal text-sm min-w-[130px] justify-between">
                  {filters.direction === 'all' ? 'All Directions' : filters.direction === 'in' ? 'Stock In (+)' : 'Stock Out (−)'}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1 min-w-[140px]" align="start">
                <div className="flex flex-col">
                  {[
                    { value: 'all', label: 'All Directions' },
                    { value: 'in', label: 'Stock In (+)' },
                    { value: 'out', label: 'Stock Out (−)' },
                  ].map(opt => (
                    <Button
                      key={opt.value}
                      variant="ghost"
                      size="sm"
                      className={cn('justify-start font-normal text-sm', filters.direction === opt.value && 'bg-accent text-accent-foreground')}
                      onClick={() => updateFilter({ direction: opt.value as any })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 font-normal text-sm min-w-[120px] justify-between">
                  {filters.type === 'all' ? 'All Types' : filters.type.charAt(0).toUpperCase() + filters.type.slice(1)}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1 min-w-[130px]" align="start">
                <div className="flex flex-col">
                  {[
                    { value: 'all', label: 'All Types' },
                    { value: 'purchase', label: 'Purchase' },
                    { value: 'order', label: 'Order' },
                    { value: 'adjustment', label: 'Adjustment' },
                    { value: 'waste', label: 'Waste' },
                  ].map(opt => (
                    <Button
                      key={opt.value}
                      variant="ghost"
                      size="sm"
                      className={cn('justify-start font-normal text-sm', filters.type === opt.value && 'bg-accent text-accent-foreground')}
                      onClick={() => updateFilter({ type: opt.value })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => updateFilter({ search: e.target.value })}
                className="pl-8 h-9 text-sm w-[160px]"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <Download className="h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>Export CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('xlsx')}>Export Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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
                    <TableCell className="hidden sm:table-cell text-sm">
                      {renderReference(tx)}
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

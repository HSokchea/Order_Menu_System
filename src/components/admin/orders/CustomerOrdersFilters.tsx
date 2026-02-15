import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  DollarSign,
  Filter,
  Hash,
  Layers,
  CalendarIcon,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Package,
  UtensilsCrossed,
  Store,
  X,
  StampIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import MultiSelect from 'react-select';

export type TimePreset = 'last15min' | 'last30min' | 'today' | 'custom';
export type AmountOperator = 'none' | 'gt' | 'lt' | 'between';
export type ItemCountOperator = 'none' | 'gte' | 'lte';
export type RoundsFilter = 'all' | 'single' | 'multiple';

export interface OrderFilters {
  // Time filter
  timePreset: TimePreset;
  customDateFrom?: Date;
  customDateTo?: Date;

  // Amount filter
  amountOperator: AmountOperator;
  amountValue?: number;
  amountMin?: number;
  amountMax?: number;

  // Item count filter
  itemCountOperator: ItemCountOperator;
  itemCountValue?: number;

  // Rounds filter
  roundsFilter: RoundsFilter;

  // Item status filter (show orders containing items with these statuses)
  statusContains: {
    pending: boolean;
    preparing: boolean;
    ready: boolean;
    rejected: boolean;
  };
}

export const defaultFilters: OrderFilters = {
  timePreset: 'today',
  amountOperator: 'none',
  itemCountOperator: 'none',
  roundsFilter: 'all',
  statusContains: {
    pending: false,
    preparing: false,
    ready: false,
    rejected: false,
  },
};

export type SortDirection = 'desc' | 'asc';

export type OrderTypeTab = 'all' | 'dine_in' | 'takeaway';

interface CustomerOrdersFiltersProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  onQuickFilter: (type: 'pending' | 'preparing' | 'ready' | 'rejected') => void;
  activeQuickFilter: '' | 'pending' | 'preparing' | 'ready' | 'rejected';
  sortDirection: SortDirection;
  onSortChange: (direction: SortDirection) => void;
  orderType: OrderTypeTab;
  onOrderTypeChange: (type: OrderTypeTab) => void;
  orderCounts: { all: number; dine_in: number; takeaway: number };
}

export function CustomerOrdersFilters({
  filters,
  onFiltersChange,
  onQuickFilter,
  activeQuickFilter,
  sortDirection,
  onSortChange,
  orderType,
  onOrderTypeChange,
  orderCounts,
}: CustomerOrdersFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<{ from?: Date; to?: Date }>({});

  const updateFilter = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const updateStatusContains = (status: keyof OrderFilters['statusContains'], checked: boolean) => {
    onFiltersChange({
      ...filters,
      statusContains: { ...filters.statusContains, [status]: checked },
    });
  };

  const resetFilters = () => {
    onFiltersChange(defaultFilters);
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.timePreset !== 'today') count++;
    if (filters.amountOperator !== 'none') count++;
    if (filters.itemCountOperator !== 'none') count++;
    if (filters.roundsFilter !== 'all') count++;
    if (Object.values(filters.statusContains).some(v => v)) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    setTempDateRange(range);
    if (range.from && range.to) {
      onFiltersChange({
        ...filters,
        timePreset: 'custom',
        customDateFrom: range.from,
        customDateTo: range.to,
      });
      setCalendarOpen(false);
    }
  };

  const statusOptions = [
    { value: 'pending', label: <span className="text-yellow-600">Pending</span> },
    { value: 'preparing', label: <span className="text-blue-600">Preparing</span> },
    { value: 'ready', label: <span className="text-green-600">Ready</span> },
    { value: 'rejected', label: <span className="text-red-600">Rejected</span> },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Order Type */}
      <Select value={orderType} onValueChange={(v) => onOrderTypeChange(v as OrderTypeTab)}>
        <SelectTrigger className="w-[150px] h-8 text-xs hover:text-foreground hover:bg-accent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-2"><Package className="h-3.5 w-3.5" /> All ({orderCounts.all})</span>
          </SelectItem>
          <SelectItem value="dine_in">
            <span className="flex items-center gap-2"><UtensilsCrossed className="h-3.5 w-3.5" /> Dine-in ({orderCounts.dine_in})</span>
          </SelectItem>
          <SelectItem value="takeaway">
            <span className="flex items-center gap-2"><Store className="h-3.5 w-3.5" /> Takeaway ({orderCounts.takeaway})</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={activeQuickFilter || "all"}
        onValueChange={v => onQuickFilter(v === 'all' ? '' as any : v as 'pending' | 'preparing' | 'ready' | 'rejected')}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs hover:bg-accent hover:text-foreground">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending">
            <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Pending</span>
          </SelectItem>
          <SelectItem value="preparing">
            <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" /> Preparing</span>
          </SelectItem>
          <SelectItem value="ready">
            <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" /> Ready</span>
          </SelectItem>
          <SelectItem value="rejected">
            <span className="flex items-center gap-2"><X className="h-3.5 w-3.5" /> Rejected</span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Time select */}
      <Select
        value={filters.timePreset}
        onValueChange={(v) => updateFilter('timePreset', v as TimePreset)}
      >
        <SelectTrigger className="w-[150px] h-8 text-xs hover:bg-accent hover:text-foreground">
          <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last15min">Last 15 min</SelectItem>
          <SelectItem value="last30min">Last 30 min</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      {/* Custom date picker */}
      {filters.timePreset === 'custom' && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              {filters.customDateFrom && filters.customDateTo
                ? `${format(filters.customDateFrom, 'MMM d')} – ${format(filters.customDateTo, 'MMM d')}`
                : 'Pick dates'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="range"
              defaultMonth={tempDateRange.from || new Date()}
              selected={tempDateRange as { from: Date; to: Date }}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Sort */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSortChange(sortDirection === 'desc' ? 'asc' : 'desc')}
        className="h-8 gap-1.5 text-xs border text-muted-foreground hover:text-foreground"
      >
        {sortDirection === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUp className="h-3.5 w-3.5" />
        )}
        {sortDirection === 'desc' ? 'Newest' : 'Oldest'}
      </Button>

      {/* Advanced Filters */}
      <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs border text-muted-foreground hover:text-foreground",
              activeCount > 0 && "text-foreground"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px] rounded-full">
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[520px] max-w-[calc(100vw-2rem)] p-4" align="center">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Advanced Filters</h4>
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 gap-1 text-xs text-muted-foreground">
                  <RotateCcw className="h-3 w-3" />
                  Reset all
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Total Amount */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  Total Amount
                </Label>
                <Select
                  value={filters.amountOperator}
                  onValueChange={(v) => updateFilter('amountOperator', v as AmountOperator)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any amount</SelectItem>
                    <SelectItem value="gt">Greater than</SelectItem>
                    <SelectItem value="lt">Less than</SelectItem>
                    <SelectItem value="between">Between</SelectItem>
                  </SelectContent>
                </Select>
                {filters.amountOperator === 'gt' && (
                  <Input type="number" placeholder="$ min" className="h-8 text-xs"
                    value={filters.amountValue || ''}
                    onChange={(e) => updateFilter('amountValue', parseFloat(e.target.value) || undefined)}
                  />
                )}
                {filters.amountOperator === 'lt' && (
                  <Input type="number" placeholder="$ max" className="h-8 text-xs"
                    value={filters.amountValue || ''}
                    onChange={(e) => updateFilter('amountValue', parseFloat(e.target.value) || undefined)}
                  />
                )}
                {filters.amountOperator === 'between' && (
                  <div className="flex gap-2">
                    <Input type="number" placeholder="$ min" className="h-8 text-xs"
                      value={filters.amountMin || ''}
                      onChange={(e) => updateFilter('amountMin', parseFloat(e.target.value) || undefined)}
                    />
                    <Input type="number" placeholder="$ max" className="h-8 text-xs"
                      value={filters.amountMax || ''}
                      onChange={(e) => updateFilter('amountMax', parseFloat(e.target.value) || undefined)}
                    />
                  </div>
                )}
              </div>

              {/* Item Count */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  Item Count
                </Label>
                <Select
                  value={filters.itemCountOperator}
                  onValueChange={(v) => updateFilter('itemCountOperator', v as ItemCountOperator)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any count</SelectItem>
                    <SelectItem value="gte">≥ (at least)</SelectItem>
                    <SelectItem value="lte">≤ (at most)</SelectItem>
                  </SelectContent>
                </Select>
                {filters.itemCountOperator !== 'none' && (
                  <Input type="number" placeholder="Count" min={1} className="h-8 text-xs"
                    value={filters.itemCountValue || ''}
                    onChange={(e) => updateFilter('itemCountValue', parseInt(e.target.value) || undefined)}
                  />
                )}
              </div>

              {/* Rounds */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  Order Rounds
                </Label>
                <Select
                  value={filters.roundsFilter}
                  onValueChange={(v) => updateFilter('roundsFilter', v as RoundsFilter)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All orders</SelectItem>
                    <SelectItem value="single">Single round</SelectItem>
                    <SelectItem value="multiple">Multiple rounds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Item Status */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <StampIcon className="h-3.5 w-3.5" />
                  Contains Status
                </Label>

                <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                  {[
                    { key: "pending" as const, label: "Pending", color: "text-yellow-600" },
                    { key: "preparing" as const, label: "Preparing", color: "text-blue-600" },
                    { key: "ready" as const, label: "Ready", color: "text-green-600" },
                    { key: "rejected" as const, label: "Rejected", color: "text-red-600" },
                  ].map(({ key, label, color }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.statusContains[key]}
                        onCheckedChange={(checked) =>
                          updateStatusContains(key, !!checked)
                        }
                      />
                      <span className={color}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reset (only when advanced filters active) */}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs text-muted-foreground">
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  );
}

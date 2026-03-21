import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  DollarSign,
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
  StampIcon,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export type TimePreset = 'last15min' | 'last30min' | 'today' | 'custom';
export type AmountOperator = 'none' | 'gt' | 'lt' | 'between';
export type ItemCountOperator = 'none' | 'gte' | 'lte';
export type RoundsFilter = 'all' | 'single' | 'multiple';

export interface OrderFilters {
  timePreset: TimePreset;
  customDateFrom?: Date;
  customDateTo?: Date;
  amountOperator: AmountOperator;
  amountValue?: number;
  amountMin?: number;
  amountMax?: number;
  itemCountOperator: ItemCountOperator;
  itemCountValue?: number;
  roundsFilter: RoundsFilter;
  statusContains: {
    pending: boolean;
    confirmed: boolean;
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
    confirmed: false,
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
  onQuickFilter: (type: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'rejected') => void;
  activeQuickFilter: '' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'rejected';
  sortDirection: SortDirection;
  onSortChange: (direction: SortDirection) => void;
  orderType: OrderTypeTab;
  onOrderTypeChange: (type: OrderTypeTab) => void;
  orderCounts: { all: number; dine_in: number; takeaway: number };
}

const orderTypeOptions = [
  { value: 'all' as const, label: 'All', icon: Package },
  { value: 'dine_in' as const, label: 'Dine-in', icon: UtensilsCrossed },
  { value: 'takeaway' as const, label: 'Takeaway', icon: Store },
];

const statusFilterOptions = [
  { value: '' as const, label: 'All Statuses' },
  { value: 'pending' as const, label: 'Pending', icon: Clock },
  { value: 'confirmed' as const, label: 'Confirmed', icon: Hash },
  { value: 'preparing' as const, label: 'Preparing', icon: Layers },
  { value: 'ready' as const, label: 'Ready', icon: Hash },
  { value: 'rejected' as const, label: 'Rejected', icon: X },
];

const datePresets = [
  { value: 'last15min' as const, label: 'Last 15 min' },
  { value: 'last30min' as const, label: 'Last 30 min' },
  { value: 'today' as const, label: 'Today' },
  { value: 'custom' as const, label: 'Custom Range' },
];

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
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
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

  const handleDatePreset = (preset: TimePreset) => {
    if (preset === 'custom') {
      setShowCalendar(true);
      setTempDateRange({
        from: filters.customDateFrom,
        to: filters.customDateTo,
      });
    } else {
      setShowCalendar(false);
      onFiltersChange({ ...filters, timePreset: preset });
      setDateOpen(false);
    }
  };

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
      setShowCalendar(false);
      setDateOpen(false);
    }
  };

  const getDateLabel = () => {
    if (filters.timePreset === 'custom' && filters.customDateFrom && filters.customDateTo) {
      return `${format(filters.customDateFrom, 'dd MMM yyyy')} - ${format(filters.customDateTo, 'dd MMM yyyy')}`;
    }
    return datePresets.find(p => p.value === filters.timePreset)?.label || 'Today';
  };

  const getOrderTypeLabel = () => {
    const opt = orderTypeOptions.find(o => o.value === orderType);
    return opt ? `${opt.label} (${orderCounts[opt.value]})` : 'All';
  };

  const getStatusLabel = () => {
    if (!activeQuickFilter) return 'All Statuses';
    return statusFilterOptions.find(o => o.value === activeQuickFilter)?.label || 'All Statuses';
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Order Type Popover */}
      <Popover open={orderTypeOpen} onOpenChange={setOrderTypeOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 font-normal text-sm">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            {getOrderTypeLabel()}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1 min-w-[160px]" align="start">
          <div className="flex flex-col">
            {orderTypeOptions.map(opt => {
              const Icon = opt.icon;
              return (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'justify-start font-normal text-sm gap-2',
                    orderType === opt.value && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => {
                    onOrderTypeChange(opt.value);
                    setOrderTypeOpen(false);
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label} ({orderCounts[opt.value]})
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Status Filter Popover */}
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 font-normal text-sm">
            {getStatusLabel()}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1 min-w-[160px]" align="start">
          <div className="flex flex-col">
            {statusFilterOptions.map(opt => (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                className={cn(
                  'justify-start font-normal text-sm gap-2',
                  activeQuickFilter === opt.value && 'bg-accent text-accent-foreground'
                )}
                onClick={() => {
                  onQuickFilter(opt.value as any);
                  setStatusOpen(false);
                }}
              >
                {opt.icon && <opt.icon className="h-3.5 w-3.5" />}
                {opt.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date Filter Popover (side-by-side like Inventory History) */}
      <Popover open={dateOpen} onOpenChange={(open) => {
        setDateOpen(open);
        if (!open) setShowCalendar(false);
      }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 font-normal text-sm">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {getDateLabel()}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="relative">
            <div className="flex flex-col p-1 min-w-[140px]">
              {datePresets.map(preset => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'justify-start font-normal text-sm',
                    filters.timePreset === preset.value && !showCalendar && 'bg-accent text-accent-foreground',
                    preset.value === 'custom' && showCalendar && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => handleDatePreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {showCalendar && (
              <div className="absolute left-full top-[-1px] z-50 ml-1 border border-border rounded-xl bg-popover shadow-sm">
                <Calendar
                  mode="range"
                  defaultMonth={tempDateRange.from || new Date()}
                  selected={tempDateRange as { from: Date; to: Date }}
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

      {/* Sort */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSortChange(sortDirection === 'desc' ? 'asc' : 'desc')}
        className="h-9 font-normal text-sm gap-1.5 border"
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
              "h-9 gap-1.5 font-normal text-sm border",
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Total Amount */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  Total Amount
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full h-8 justify-between text-xs font-normal">
                      {filters.amountOperator === 'none' ? 'Any amount' :
                        filters.amountOperator === 'gt' ? 'Greater than' :
                          filters.amountOperator === 'lt' ? 'Less than' : 'Between'}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1 min-w-[140px]" align="start">
                    <div className="flex flex-col">
                      {[
                        { value: 'none', label: 'Any amount' },
                        { value: 'gt', label: 'Greater than' },
                        { value: 'lt', label: 'Less than' },
                        { value: 'between', label: 'Between' },
                      ].map(opt => (
                        <Button
                          key={opt.value}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'justify-start font-normal text-xs',
                            filters.amountOperator === opt.value && 'bg-accent text-accent-foreground'
                          )}
                          onClick={() => updateFilter('amountOperator', opt.value as AmountOperator)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full h-8 justify-between text-xs font-normal">
                      {filters.itemCountOperator === 'none' ? 'Any count' :
                        filters.itemCountOperator === 'gte' ? '≥ (at least)' : '≤ (at most)'}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1 min-w-[140px]" align="start">
                    <div className="flex flex-col">
                      {[
                        { value: 'none', label: 'Any count' },
                        { value: 'gte', label: '≥ (at least)' },
                        { value: 'lte', label: '≤ (at most)' },
                      ].map(opt => (
                        <Button
                          key={opt.value}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'justify-start font-normal text-xs',
                            filters.itemCountOperator === opt.value && 'bg-accent text-accent-foreground'
                          )}
                          onClick={() => updateFilter('itemCountOperator', opt.value as ItemCountOperator)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full h-8 justify-between text-xs font-normal">
                      {filters.roundsFilter === 'all' ? 'All orders' :
                        filters.roundsFilter === 'single' ? 'Single round' : 'Multiple rounds'}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1 min-w-[140px]" align="start">
                    <div className="flex flex-col">
                      {[
                        { value: 'all', label: 'All orders' },
                        { value: 'single', label: 'Single round' },
                        { value: 'multiple', label: 'Multiple rounds' },
                      ].map(opt => (
                        <Button
                          key={opt.value}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'justify-start font-normal text-xs',
                            filters.roundsFilter === opt.value && 'bg-accent text-accent-foreground'
                          )}
                          onClick={() => updateFilter('roundsFilter', opt.value as RoundsFilter)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
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
                    { key: "confirmed" as const, label: "Confirmed", color: "text-purple-600" },
                    { key: "preparing" as const, label: "Preparing", color: "text-blue-600" },
                    { key: "ready" as const, label: "Ready", color: "text-green-600" },
                    { key: "rejected" as const, label: "Rejected", color: "text-red-600" },
                  ].map(({ key, label, color }) => (
                    <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={filters.statusContains[key]}
                        onCheckedChange={(checked) => updateStatusContains(key, !!checked)}
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

      {/* Reset */}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs text-muted-foreground">
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  );
}

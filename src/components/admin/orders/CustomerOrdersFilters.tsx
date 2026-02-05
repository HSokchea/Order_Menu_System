import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, 
  DollarSign, 
  Filter, 
  Hash, 
  Layers, 
  ChevronDown,
  X,
  CalendarIcon,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface CustomerOrdersFiltersProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  onQuickFilter: (type: 'waiting' | 'inProgress' | 'ready') => void;
  activeQuickFilter: string | null;
}

export function CustomerOrdersFilters({
  filters,
  onFiltersChange,
  onQuickFilter,
  activeQuickFilter,
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

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeQuickFilter === 'waiting' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onQuickFilter('waiting')}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Waiting to Prepare
        </Button>
        <Button
          variant={activeQuickFilter === 'inProgress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onQuickFilter('inProgress')}
          className="gap-2"
        >
          <Layers className="h-4 w-4" />
          In Progress
        </Button>
        <Button
          variant={activeQuickFilter === 'ready' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onQuickFilter('ready')}
          className="gap-2"
        >
          <Hash className="h-4 w-4" />
          Ready to Serve
        </Button>
      </div>

      {/* Main Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Time Filter */}
        <div className="flex items-center gap-2">
          <Select
            value={filters.timePreset}
            onValueChange={(v) => updateFilter('timePreset', v as TimePreset)}
          >
            <SelectTrigger className="w-[160px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last15min">Last 15 minutes</SelectItem>
              <SelectItem value="last30min">Last 30 minutes</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {filters.timePreset === 'custom' && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {filters.customDateFrom && filters.customDateTo
                    ? `${format(filters.customDateFrom, 'MMM d')} - ${format(filters.customDateTo, 'MMM d')}`
                    : 'Select dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
        </div>

        {/* Advanced Filters Toggle */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="flex-1">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Advanced Filters
                {activeCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeCount}
                  </Badge>
                )}
                <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>

            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>

          <CollapsibleContent className="mt-4">
            <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Total Amount Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="h-4 w-4" />
                    Total Amount
                  </Label>
                  <Select
                    value={filters.amountOperator}
                    onValueChange={(v) => updateFilter('amountOperator', v as AmountOperator)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any amount</SelectItem>
                      <SelectItem value="gt">Greater than</SelectItem>
                      <SelectItem value="lt">Less than</SelectItem>
                      <SelectItem value="between">Between</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {filters.amountOperator === 'gt' && (
                    <Input
                      type="number"
                      placeholder="$ min"
                      value={filters.amountValue || ''}
                      onChange={(e) => updateFilter('amountValue', parseFloat(e.target.value) || undefined)}
                    />
                  )}
                  {filters.amountOperator === 'lt' && (
                    <Input
                      type="number"
                      placeholder="$ max"
                      value={filters.amountValue || ''}
                      onChange={(e) => updateFilter('amountValue', parseFloat(e.target.value) || undefined)}
                    />
                  )}
                  {filters.amountOperator === 'between' && (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="$ min"
                        value={filters.amountMin || ''}
                        onChange={(e) => updateFilter('amountMin', parseFloat(e.target.value) || undefined)}
                      />
                      <Input
                        type="number"
                        placeholder="$ max"
                        value={filters.amountMax || ''}
                        onChange={(e) => updateFilter('amountMax', parseFloat(e.target.value) || undefined)}
                      />
                    </div>
                  )}
                </div>

                {/* Item Count Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Hash className="h-4 w-4" />
                    Item Count
                  </Label>
                  <Select
                    value={filters.itemCountOperator}
                    onValueChange={(v) => updateFilter('itemCountOperator', v as ItemCountOperator)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any count</SelectItem>
                      <SelectItem value="gte">≥ (at least)</SelectItem>
                      <SelectItem value="lte">≤ (at most)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {filters.itemCountOperator !== 'none' && (
                    <Input
                      type="number"
                      placeholder="Number of items"
                      min={1}
                      value={filters.itemCountValue || ''}
                      onChange={(e) => updateFilter('itemCountValue', parseInt(e.target.value) || undefined)}
                    />
                  )}
                </div>

                {/* Rounds Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Layers className="h-4 w-4" />
                    Order Rounds
                  </Label>
                  <Select
                    value={filters.roundsFilter}
                    onValueChange={(v) => updateFilter('roundsFilter', v as RoundsFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All orders</SelectItem>
                      <SelectItem value="single">Single round (= 1)</SelectItem>
                      <SelectItem value="multiple">Multiple rounds (≥ 2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Item Status Contains Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Item Status Contains</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.statusContains.pending}
                        onCheckedChange={(checked) => updateStatusContains('pending', !!checked)}
                      />
                      <span className="text-yellow-600">Pending</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.statusContains.preparing}
                        onCheckedChange={(checked) => updateStatusContains('preparing', !!checked)}
                      />
                      <span className="text-blue-600">Preparing</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.statusContains.ready}
                        onCheckedChange={(checked) => updateStatusContains('ready', !!checked)}
                      />
                      <span className="text-green-600">Ready</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filters.statusContains.rejected}
                        onCheckedChange={(checked) => updateStatusContains('rejected', !!checked)}
                      />
                      <span className="text-red-600">Rejected</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRangePreset, DateRange } from '@/hooks/useOrderAnalytics';

interface DateRangeFilterProps {
  preset: DateRangePreset;
  customRange: DateRange | undefined;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomRangeChange: (range: DateRange) => void;
}

const presets: { label: string; value: DateRangePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'last7days' },
  { label: 'Last 30 Days', value: 'last30days' },
  { label: 'Custom', value: 'custom' },
];

export function DateRangeFilter({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
}: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({
    from: customRange?.from,
    to: customRange?.to,
  });

  const handlePresetClick = (newPreset: DateRangePreset) => {
    if (newPreset === 'custom') {
      setCalendarOpen(true);
    } else {
      onPresetChange(newPreset);
    }
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    setTempRange(range);
    
    if (range.from && range.to) {
      onCustomRangeChange({ from: range.from, to: range.to });
      onPresetChange('custom');
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        p.value === 'custom' ? (
          <Popover key={p.value} open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={preset === p.value ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'gap-2',
                  preset === p.value && 'bg-primary text-primary-foreground'
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {preset === 'custom' && customRange 
                  ? `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d')}`
                  : p.label
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={tempRange.from}
                selected={tempRange as { from: Date; to: Date }}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            key={p.value}
            variant={preset === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(p.value)}
            className={preset === p.value ? 'bg-primary text-primary-foreground' : ''}
          >
            {p.label}
          </Button>
        )
      ))}
    </div>
  );
}

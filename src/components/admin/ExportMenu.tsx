import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportData } from '@/lib/exportUtils';
import { toast } from 'sonner';
import type { OrderData, DateRange } from '@/hooks/useOrderAnalytics';

interface ExportMenuProps {
  orders: OrderData[];
  dateRange: DateRange;
  disabled?: boolean;
  restaurantName?: string;
  currency?: string;
}

export function ExportMenu({ orders, dateRange, disabled, restaurantName, currency }: ExportMenuProps) {
  const handleExport = (type: 'orders' | 'revenue-summary', format: 'csv' | 'xlsx') => {
    const result = exportData({ orders, dateRange, type, format, restaurantName, currency });
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Orders List</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport('orders', 'csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('orders', 'xlsx')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>Revenue Summary</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport('revenue-summary', 'csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('revenue-summary', 'xlsx')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

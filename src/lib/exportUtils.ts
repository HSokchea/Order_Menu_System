import * as XLSX from 'xlsx';
import { format, eachDayOfInterval } from 'date-fns';
import type { OrderData, DateRange } from '@/hooks/useOrderAnalytics';

interface ExportOptions {
  orders: OrderData[];
  dateRange: DateRange;
  type: 'orders' | 'revenue-summary';
  format: 'csv' | 'xlsx';
  restaurantName?: string;
  currency?: string;
}

function generateOrdersData(orders: OrderData[], currency: string = 'USD') {
  // Only completed orders for exports per requirements
  const completedOrders = orders.filter(o => o.status === 'completed');
  
  return completedOrders.map(order => ({
    'Order ID': order.id,
    'Date': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
    'Table': order.table_number,
    [`Total (${currency})`]: order.total_usd?.toFixed(2) || '0.00',
    'Status': order.status,
    'Notes': order.customer_notes || '',
  }));
}

function generateRevenueSummaryData(orders: OrderData[], dateRange: DateRange, currency: string = 'USD') {
  // Only completed orders for revenue
  const completedOrders = orders.filter(o => o.status === 'completed');
  
  // Group by day
  const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
  const revenueByDay = new Map<string, { revenue: number; orderCount: number }>();
  
  days.forEach(day => {
    revenueByDay.set(format(day, 'yyyy-MM-dd'), { revenue: 0, orderCount: 0 });
  });

  completedOrders.forEach(order => {
    const dayKey = format(new Date(order.created_at), 'yyyy-MM-dd');
    const existing = revenueByDay.get(dayKey) || { revenue: 0, orderCount: 0 };
    revenueByDay.set(dayKey, {
      revenue: existing.revenue + (order.total_usd || 0),
      orderCount: existing.orderCount + 1,
    });
  });

  return days.map(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const data = revenueByDay.get(dayKey) || { revenue: 0, orderCount: 0 };
    return {
      'Date': dayKey,
      'Orders': data.orderCount,
      [`Revenue (${currency})`]: data.revenue.toFixed(2),
      [`Avg Order Value (${currency})`]: data.orderCount > 0 
        ? (data.revenue / data.orderCount).toFixed(2) 
        : '0.00',
    };
  });
}

export function exportData({ orders, dateRange, type, format: exportFormat, restaurantName, currency = 'USD' }: ExportOptions) {
  const data = type === 'orders' 
    ? generateOrdersData(orders, currency)
    : generateRevenueSummaryData(orders, dateRange, currency);

  if (data.length === 0) {
    return { success: false, message: 'No data to export' };
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  // Create sheet name with restaurant name if available
  const sheetName = type === 'orders' ? 'Orders' : 'Revenue Summary';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Set column widths
  const colWidths = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 15) }));
  worksheet['!cols'] = colWidths;

  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const prefix = restaurantName ? `${restaurantName.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
  const fileName = `${prefix}${type === 'orders' ? 'orders' : 'revenue-summary'}_${dateStr}.${exportFormat}`;

  if (exportFormat === 'csv') {
    XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' });
  }

  return { success: true, message: `Exported ${data.length} records` };
}

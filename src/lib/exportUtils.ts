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
  exchangeRate?: number;
}

function roundKHRto100(khr: number): number {
  return Math.round(khr / 100) * 100;
}

function generateOrdersData(orders: OrderData[], currency: string = 'USD', exchangeRate: number = 4100) {
  // Only completed orders for exports per requirements
  const completedOrders = orders.filter(o => o.status === 'completed');
  
  return completedOrders.map(order => {
    const totalUSD = order.total_usd || 0;
    const totalKHR = roundKHRto100(totalUSD * exchangeRate);
    
    return {
      'Order ID': order.id,
      'Date': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
      'Table': order.table_number,
      [`Total (${currency})`]: totalUSD.toFixed(2),
      'Total (KHR)': totalKHR.toLocaleString(),
      'Exchange Rate': exchangeRate,
      'Status': order.status,
      'Notes': order.customer_notes || '',
    };
  });
}

function generateRevenueSummaryData(orders: OrderData[], dateRange: DateRange, currency: string = 'USD', exchangeRate: number = 4100) {
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
    const revenueKHR = roundKHRto100(data.revenue * exchangeRate);
    const avgOrderKHR = data.orderCount > 0 
      ? roundKHRto100((data.revenue / data.orderCount) * exchangeRate) 
      : 0;
    
    return {
      'Date': dayKey,
      'Orders': data.orderCount,
      [`Revenue (${currency})`]: data.revenue.toFixed(2),
      'Revenue (KHR)': revenueKHR.toLocaleString(),
      [`Avg Order Value (${currency})`]: data.orderCount > 0 
        ? (data.revenue / data.orderCount).toFixed(2) 
        : '0.00',
      'Avg Order Value (KHR)': avgOrderKHR.toLocaleString(),
      'Exchange Rate': exchangeRate,
    };
  });
}

export function exportData({ orders, dateRange, type, format: exportFormat, restaurantName, currency = 'USD', exchangeRate = 4100 }: ExportOptions) {
  const data = type === 'orders' 
    ? generateOrdersData(orders, currency, exchangeRate)
    : generateRevenueSummaryData(orders, dateRange, currency, exchangeRate);

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

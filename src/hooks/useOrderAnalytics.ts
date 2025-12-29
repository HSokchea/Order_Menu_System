import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from 'date-fns';

export type DateRangePreset = 'today' | 'last7days' | 'last30days' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface OrderData {
  id: string;
  created_at: string;
  status: string;
  total_usd: number | null;
  table_number: string;
  customer_notes: string | null;
}

export interface AnalyticsData {
  orders: OrderData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface KPIData {
  totalRevenue: number;
  completedOrderCount: number;
  averageOrderValue: number;
  statusCounts: {
    new: number;
    preparing: number;
    ready: number;
    completed: number;
    rejected: number;
  };
}

export interface ChartData {
  revenueOverTime: { date: string; revenue: number }[];
  ordersOverTime: { date: string; orders: number }[];
  statusDistribution: { name: string; value: number; fill: string }[];
}

export function getDateRangeFromPreset(preset: DateRangePreset, customRange?: DateRange): DateRange {
  const today = new Date();
  
  switch (preset) {
    case 'today':
      return { from: startOfDay(today), to: endOfDay(today) };
    case 'last7days':
      return { from: startOfDay(subDays(today, 6)), to: endOfDay(today) };
    case 'last30days':
      return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) };
    case 'custom':
      return customRange || { from: startOfDay(today), to: endOfDay(today) };
    default:
      return { from: startOfDay(today), to: endOfDay(today) };
  }
}

export function useOrderAnalytics(dateRange: DateRange): AnalyticsData {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      // First get restaurant ID
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!restaurant) {
        setError('Restaurant not found');
        setLoading(false);
        return;
      }

      // Fetch orders within date range
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, created_at, status, total_usd, table_number, customer_notes')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user, dateRange.from.getTime(), dateRange.to.getTime()]);

  return { orders, loading, error, refetch: fetchOrders };
}

export function useKPIData(orders: OrderData[]): KPIData {
  return useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_usd || 0), 0);
    const completedOrderCount = completedOrders.length;
    const averageOrderValue = completedOrderCount > 0 ? totalRevenue / completedOrderCount : 0;

    const statusCounts = {
      new: orders.filter(o => o.status === 'new').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      completed: orders.filter(o => o.status === 'completed').length,
      rejected: orders.filter(o => o.status === 'rejected').length,
    };

    return {
      totalRevenue,
      completedOrderCount,
      averageOrderValue,
      statusCounts,
    };
  }, [orders]);
}

export function useChartData(orders: OrderData[], dateRange: DateRange): ChartData {
  return useMemo(() => {
    // Generate all days in range for consistent charts
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    // Revenue over time (completed orders only)
    const revenueByDay = new Map<string, number>();
    const ordersByDay = new Map<string, number>();
    
    days.forEach(day => {
      const key = format(day, 'MMM dd');
      revenueByDay.set(key, 0);
      ordersByDay.set(key, 0);
    });

    orders.forEach(order => {
      const orderDate = format(new Date(order.created_at), 'MMM dd');
      
      // Count all orders
      ordersByDay.set(orderDate, (ordersByDay.get(orderDate) || 0) + 1);
      
      // Only completed orders contribute to revenue
      if (order.status === 'completed') {
        revenueByDay.set(orderDate, (revenueByDay.get(orderDate) || 0) + (order.total_usd || 0));
      }
    });

    const revenueOverTime = days.map(day => ({
      date: format(day, 'MMM dd'),
      revenue: revenueByDay.get(format(day, 'MMM dd')) || 0,
    }));

    const ordersOverTime = days.map(day => ({
      date: format(day, 'MMM dd'),
      orders: ordersByDay.get(format(day, 'MMM dd')) || 0,
    }));

    // Status distribution
    const statusColors: Record<string, string> = {
      new: 'hsl(210, 100%, 50%)',
      preparing: 'hsl(45, 100%, 50%)',
      ready: 'hsl(145, 70%, 45%)',
      completed: 'hsl(160, 60%, 40%)',
      rejected: 'hsl(0, 70%, 55%)',
    };

    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      fill: statusColors[status] || 'hsl(0, 0%, 50%)',
    }));

    return { revenueOverTime, ordersOverTime, statusDistribution };
  }, [orders, dateRange]);
}

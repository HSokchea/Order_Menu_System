import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
import { ExportMenu } from '@/components/admin/ExportMenu';
import { AnalyticsCharts } from '@/components/admin/AnalyticsCharts';
import {
  useOrderAnalytics,
  useKPIData,
  useChartData,
  getDateRangeFromPreset,
  type DateRangePreset,
  type DateRange,
} from '@/hooks/useOrderAnalytics';
import { useRestaurantProfile } from '@/hooks/useRestaurantProfile';

const Dashboard = () => {
  const [preset, setPreset] = useState<DateRangePreset>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const dateRange = getDateRangeFromPreset(preset, customRange);
  const { orders, loading, refetch } = useOrderAnalytics(dateRange);
  const kpi = useKPIData(orders);
  const chartData = useChartData(orders, dateRange);
  const { restaurant } = useRestaurantProfile();

  const currency = restaurant?.currency || 'USD';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-8">
      {/* Header with Filters and Export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">
            {restaurant?.name ? `${restaurant.name} Dashboard` : 'Sales Dashboard'}
          </h2>
          <p className="text-muted-foreground">
            Track your restaurant's performance and revenue
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeFilter
            preset={preset}
            customRange={customRange}
            onPresetChange={setPreset}
            onCustomRangeChange={setCustomRange}
          />
          <ExportMenu orders={orders} dateRange={dateRange} disabled={loading} restaurantName={restaurant?.name} currency={currency} exchangeRate={restaurant?.exchange_rate_usd_to_khr} />
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-background hover:shadow-md transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="secondary" className="text-xs">Completed</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpi.totalRevenue)}</div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Completed Orders */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-whitedark:from-blue-950/40 dark:to-background hover:shadow-md transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-secondary" />
              </div>
              <Badge variant="secondary" className="text-xs">Completed</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpi.completedOrderCount}</div>
                <p className="text-sm text-muted-foreground">Orders</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Average Order Value */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-background hover:shadow-md transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-accent-foreground" />
              </div>
              <Badge variant="secondary" className="text-xs">Average</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpi.averageOrderValue)}</div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Live Status Counts */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/60 dark:to-background hover:shadow-md transition-all">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <Badge variant="secondary" className="text-xs">All Status</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="h-8 w-full bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">New:</span>
                  <span className="font-semibold">{kpi.statusCounts.new}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <ChefHat className="h-3 w-3 text-yellow-500" />
                  <span className="text-muted-foreground">Prep:</span>
                  <span className="font-semibold">{kpi.statusCounts.preparing}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Ready:</span>
                  <span className="font-semibold">{kpi.statusCounts.ready}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span className="text-muted-foreground">Rej:</span>
                  <span className="font-semibold">{kpi.statusCounts.rejected}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <AnalyticsCharts chartData={chartData} loading={loading} />
    </div>
  );
};

export default Dashboard;

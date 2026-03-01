import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RefreshCw, Clock, ChefHat, CheckCircle2, XCircle, Utensils, ShoppingBag, Copy, Check, Receipt, Plus } from 'lucide-react';
import { useActiveOrder } from '@/hooks/useActiveOrder';
import { groupOrderItems, calculateOrderTotal, groupItemsIntoRounds } from '@/types/order';
import type { GroupedOrderItem } from '@/types/order';
import { format } from 'date-fns';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ── Timeline Steps ──────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: 'placed', label: 'Order Confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: CheckCircle2 },
  { key: 'paid', label: 'Completed', icon: CheckCircle2 },
] as const;

const STATUS_ORDER: Record<string, number> = { placed: 0, preparing: 1, ready: 2, paid: 3 };

// ── Item status dot colors using semantic tokens ────────────────
const statusDotClass: Record<string, string> = {
  pending: 'bg-primary/60',
  preparing: 'bg-warning',
  ready: 'bg-success',
  rejected: 'bg-destructive',
};

const statusLabelClass: Record<string, string> = {
  pending: 'text-primary/70',
  preparing: 'text-warning-foreground bg-warning/10',
  ready: 'text-success-foreground bg-success/10',
  rejected: 'text-destructive',
};

// ── Main Component ──────────────────────────────────────────────
const ActiveOrder = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table_id');
  const { order, shop, isLoading, error, refetch } = useActiveOrder(shopId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const menuUrl = tableId ? `/menu/${shopId}?table_id=${tableId}` : `/menu/${shopId}`;
  const billUrl = tableId ? `/menu/${shopId}/bill?table_id=${tableId}` : `/menu/${shopId}/bill`;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [refetch]);

  const copyOrderId = useCallback((id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 pt-16 space-y-6">
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-4 w-28 mx-auto" />
          <div className="space-y-4 pt-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <div className="space-y-3 pt-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State ──
  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <StickyHeader menuUrl={menuUrl} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Clock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No Active Order</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">You don't have any active orders right now.</p>
          <Button asChild className="rounded-full px-6">
            <Link to={menuUrl}>Back to Menu</Link>
          </Button>
        </main>
      </div>
    );
  }

  // ── Derived Data ──
  const groupedItems = groupOrderItems(order.items);
  const total = calculateOrderTotal(order.items);
  const match = order.created_at.match(/\.(\d+)/);
  const shortId = match ? `#${match[1].slice(-4)}` : `#${order.id.slice(-4)}`;
  const currentStatusIndex = STATUS_ORDER[order.status] ?? 0;

  const pendingItems = groupedItems.filter(g => g.status === 'pending');
  const preparingItems = groupedItems.filter(g => g.status === 'preparing');
  const readyItems = groupedItems.filter(g => g.status === 'ready');
  const rejectedItems = groupedItems.filter(g => g.status === 'rejected');

  const rounds = groupItemsIntoRounds(order.items);
  const specialRequests = rounds
    .filter(r => r.specialRequest)
    .map(r => ({ roundNumber: r.roundNumber, note: r.specialRequest! }));

  const orderTypeLabel = order.order_type === 'dine_in'
    ? `Dine In${order.table_number ? ` • Table ${order.table_number}` : ''}`
    : 'Takeaway';

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ── Sticky Header ── */}
      <StickyHeader
        menuUrl={menuUrl}
        title={`Order ${shortId}`}
        subtitle={`${orderTypeLabel} • ${format(new Date(order.created_at), 'h:mm a')}`}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onCopy={() => copyOrderId(order.id)}
        copied={copied}
      />

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-8">
        {/* ── Auto-updating indicator ── */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs text-muted-foreground">Auto-updating</span>
        </div>

        {/* ── Order Progress Timeline ── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Order Progress</h3>
          <div className="relative pl-4">
            {TIMELINE_STEPS.map((step, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isActive = index === currentStatusIndex;
              const isLast = index === TIMELINE_STEPS.length - 1;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="relative flex items-start gap-4 pb-6 last:pb-0">
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={cn(
                        'absolute left-[11px] top-8 w-0.5 h-[calc(100%-20px)]',
                        index < currentStatusIndex ? 'bg-success' : 'bg-border'
                      )}
                    />
                  )}

                  {/* Circle indicator */}
                  <div
                    className={cn(
                      'relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500',
                      isCompleted && !isActive && 'bg-success',
                      isActive && 'bg-primary ring-4 ring-primary/20',
                      !isCompleted && 'bg-muted border-2 border-border'
                    )}
                  >
                    {isCompleted ? (
                      <StepIcon className={cn('h-3.5 w-3.5', isActive ? 'text-primary-foreground' : 'text-success-foreground')} />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="pt-0.5">
                    <p className={cn(
                      'text-sm font-medium transition-colors',
                      isActive && 'text-foreground',
                      isCompleted && !isActive && 'text-foreground',
                      !isCompleted && 'text-muted-foreground'
                    )}>
                      {step.label}
                    </p>
                    {isActive && currentStatusIndex < 2 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Estimated {currentStatusIndex < 1 ? '15–20' : '5–10'} mins
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Order Items Section ── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Order Items</h3>

          <div className="space-y-5">
            {readyItems.length > 0 && (
              <StatusGroup label="Ready" count={readyItems.reduce((s, i) => s + i.count, 0)} status="ready" items={readyItems} />
            )}
            {preparingItems.length > 0 && (
              <StatusGroup label="Preparing" count={preparingItems.reduce((s, i) => s + i.count, 0)} status="preparing" items={preparingItems} />
            )}
            {pendingItems.length > 0 && (
              <StatusGroup label="Pending" count={pendingItems.reduce((s, i) => s + i.count, 0)} status="pending" items={pendingItems} />
            )}
            {rejectedItems.length > 0 && (
              <StatusGroup label="Rejected" count={rejectedItems.reduce((s, i) => s + i.count, 0)} status="rejected" items={rejectedItems} isRejected />
            )}
            {groupedItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No items in this order.</p>
            )}
          </div>

          {/* Special Requests */}
          {specialRequests.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</p>
              {specialRequests.map((req) => (
                <div key={req.roundNumber} className="bg-muted/40 rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Round {req.roundNumber}</p>
                  <p className="text-sm text-foreground">{req.note}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Sticky Bottom Summary Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_-4px_hsl(var(--foreground)/0.06)]">
        <div className="mx-auto max-w-2xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <div className="text-right">
              <span className="text-lg font-semibold text-foreground">${total.toFixed(2)}</span>
              {rejectedItems.length > 0 && (
                <p className="text-[10px] text-muted-foreground">Excludes rejected items</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size='sm' className="flex-1 rounded-xl bg-muted" asChild>
              <Link to={billUrl}>
                <Receipt className="h-4 w-4 mr-1.5" />
                View Bill
              </Link>
            </Button>
            <Button className="flex-1 rounded-xl" size='sm' asChild>
              <Link to={menuUrl}>
                <Plus className="h-4 w-4 mr-1.5" />
                Order More
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sticky Header ───────────────────────────────────────────────
interface StickyHeaderProps {
  menuUrl: string;
  title?: string;
  subtitle?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCopy?: () => void;
  copied?: boolean;
}

const StickyHeader = ({ menuUrl, title, subtitle, onRefresh, isRefreshing, onCopy, copied }: StickyHeaderProps) => (
  <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
    <div className="mx-auto max-w-2xl px-4 py-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 -ml-2" asChild>
          <Link to={menuUrl}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {title ? (
          <div className="text-center flex-1 min-w-0">
            <button
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 group"
            >
              <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
              {copied ? (
                <Check className="h-3 w-3 text-success flex-shrink-0" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              )}
            </button>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        ) : (
          <div className="flex-1 text-center">
            <h1 className="text-base font-semibold text-foreground">Order Status</h1>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9 -mr-2"
          onClick={onRefresh}
        >
          <RefreshCw className={cn('h-4 w-4 transition-transform', isRefreshing && 'animate-spin')} />
        </Button>
      </div>
    </div>
  </header>
);

// ── Status Group ────────────────────────────────────────────────
interface StatusGroupProps {
  label: string;
  count: number;
  status: string;
  items: GroupedOrderItem[];
  isRejected?: boolean;
}

const StatusGroup = ({ label, count, status, items, isRejected }: StatusGroupProps) => (
  <div>
    <div className="flex items-center gap-2 mb-2.5">
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotClass[status])} />
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
    <div className="space-y-1">
      {items.map((item, index) => {
        const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
        const itemTotal = (item.price + optionsTotal) * item.count;

        return (
          <div
            key={index}
            className={cn(
              'flex items-start justify-between py-2.5 px-3 rounded-xl transition-colors',
              isRejected ? 'opacity-50' : 'bg-muted/30'
            )}
          >
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium text-foreground', isRejected && 'line-through')}>
                {item.name}
              </p>
              {item.options && item.options.length > 0 && (
                <div className="mt-0.5">
                  {item.options.map((opt, idx) => (
                    <p key={idx} className={cn('text-xs text-muted-foreground', isRejected && 'line-through')}>
                      {opt.groupName}: {opt.label}
                      {opt.price !== 0 && <span> ({opt.price > 0 ? '+' : ''}${opt.price.toFixed(2)})</span>}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.count}</p>
            </div>
            <span className={cn('text-sm font-semibold text-foreground ml-4 flex-shrink-0', isRejected && 'line-through')}>
              ${itemTotal.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

export default ActiveOrder;

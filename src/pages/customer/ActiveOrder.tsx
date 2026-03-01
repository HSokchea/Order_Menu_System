import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw, Clock, ChefHat, CheckCircle2, XCircle,
  Copy, Check, Receipt, Plus, ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react';
import { useActiveOrder } from '@/hooks/useActiveOrder';
import { groupOrderItems, calculateOrderTotal, groupItemsIntoRounds } from '@/types/order';
import { computeRoundStatus, computeGlobalStatus } from '@/types/roundStatus';
import type { GroupedOrderItem, OrderRound } from '@/types/order';
import type { RoundStatus } from '@/types/roundStatus';
import { format } from 'date-fns';
import { useState, useCallback, useEffect, useRef, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import StickyHeader from '@/components/customer/StickyHeader';

// ── Horizontal Timeline Steps ───────────────────────────────────
const ROUND_TIMELINE = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
] as const;

const ROUND_STATUS_ORDER: Record<string, number> = {
  pending: -1,
  confirmed: 0,
  preparing: 1,
  ready: 2,
  completed: 2,
  rejected: -2,
};

const statusDotClass: Record<string, string> = {
  pending: 'bg-primary/60',
  preparing: 'bg-warning',
  ready: 'bg-success',
  rejected: 'bg-destructive',
};

// ── Main Component ──────────────────────────────────────────────
const ActiveOrder = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table_id');
  const { order, shop, isLoading, error, refetch } = useActiveOrder(shopId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());
  const [highlightRound, setHighlightRound] = useState<number | null>(null);
  const roundRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  const toggleRound = useCallback((roundNumber: number) => {
    setCollapsedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundNumber)) {
        next.delete(roundNumber);
      } else {
        next.add(roundNumber);
      }
      return next;
    });
  }, []);

  // Derive rounds
  const rounds = order ? groupItemsIntoRounds(order.items) : [];
  const total = order ? calculateOrderTotal(order.items) : 0;
  const rejectedCount = order?.items.filter(i => i.status === 'rejected').length ?? 0;

  // Auto-collapse completed rounds, expand latest
  useEffect(() => {
    if (rounds.length <= 1) return;
    const toCollapse = new Set<number>();
    rounds.forEach((r, idx) => {
      const status = computeRoundStatus(r.items);
      if (idx > 0 && (status === 'ready' || status === 'completed' || status === 'rejected')) {
        toCollapse.add(r.roundNumber);
      }
    });
    setCollapsedRounds(toCollapse);
  }, [rounds.length]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 pt-16 space-y-6">
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-4 w-28 mx-auto" />
          <div className="space-y-5 pt-6">
            {[1, 2].map(i => (
              <div key={i} className="rounded-2xl bg-muted/20 p-5 space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State ──
  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <StickyHeader backUrl={menuUrl} title="Track Order" />
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
  const match = order.created_at.match(/\.(\d+)/);
  const shortId = match ? `#${match[1].slice(-4)}` : `#${order.id.slice(-4)}`;
  const globalStatus = computeGlobalStatus(rounds);

  const orderTypeLabel = order.order_type === 'dine_in'
    ? `Dine In${order.table_number ? ` • Table ${order.table_number}` : ''}`
    : 'Takeaway';

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ── Sticky Header ── */}
      <StickyHeader
        backUrl={menuUrl}
        title="Track Order"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">
        {/* ── Order Info Card ── */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => copyOrderId(order.id)} className="inline-flex items-center gap-1.5 group">
              <h2 className="text-lg font-semibold text-foreground">Order {shortId}</h2>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              )}
            </button>
            <p className="text-sm text-muted-foreground">
              {orderTypeLabel} • {format(new Date(order.created_at), 'MMM d, yyyy • h:mm a')}
            </p>
          </div>
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            globalStatus === 'All Ready' && 'bg-success/10 text-success',
            globalStatus === 'In Progress' && 'bg-primary/10 text-primary',
            globalStatus === 'Cancelled' && 'bg-destructive/10 text-destructive',
          )}>
            {globalStatus}
          </span>
        </div>

        {/* ── Auto-updating indicator ── */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs text-muted-foreground">Auto-updating</span>
        </div>

        {/* ── Round Sections ── */}
        {rounds.map((round) => (
          <OrderRoundSection
            key={round.roundNumber}
            round={round}
            isCollapsed={collapsedRounds.has(round.roundNumber)}
            onToggle={() => toggleRound(round.roundNumber)}
            isHighlighted={highlightRound === round.roundNumber}
            ref={(el: HTMLDivElement | null) => {
              if (el) roundRefs.current.set(round.roundNumber, el);
            }}
          />
        ))}

        {rounds.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No items in this order.</p>
        )}
      </main>

      {/* ── Sticky Bottom Summary Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto max-w-2xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Total ({rounds.length} round{rounds.length !== 1 ? 's' : ''})</span>
            <div className="text-right">
              <span className="text-lg font-semibold text-foreground">${total.toFixed(2)}</span>
              {rejectedCount > 0 && (
                <p className="text-[10px] text-muted-foreground">Excludes rejected items</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" className="flex-1 rounded-xl bg-muted" asChild>
              <Link to={billUrl}>
                <Receipt className="h-4 w-4 mr-1.5" />
                View Bill
              </Link>
            </Button>
            <Button className="flex-1 rounded-xl" size="sm" asChild>
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

// ── Order Round Section ─────────────────────────────────────────
interface OrderRoundSectionProps {
  round: OrderRound;
  isCollapsed: boolean;
  onToggle: () => void;
  isHighlighted: boolean;
}

const OrderRoundSection = forwardRef<HTMLDivElement, OrderRoundSectionProps>(
  ({ round, isCollapsed, onToggle, isHighlighted }, ref) => {
    const roundStatus = computeRoundStatus(round.items);
    const isRejected = roundStatus === 'rejected';
    const isReady = roundStatus === 'ready' || roundStatus === 'completed';
    const groupedItems = groupOrderItems(round.items);

    const itemsByStatus = {
      ready: groupedItems.filter(g => g.status === 'ready'),
      preparing: groupedItems.filter(g => g.status === 'preparing'),
      pending: groupedItems.filter(g => g.status === 'pending'),
      rejected: groupedItems.filter(g => g.status === 'rejected'),
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl bg-muted/20 transition-all duration-300 overflow-hidden',
          isHighlighted && 'ring-2 ring-primary/30',
          isRejected && 'opacity-75',
        )}
      >
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Round {round.roundNumber}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(round.timestamp), 'MMM d, yyyy • h:mm a')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isReady && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </span>
            )}
            {isRejected && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Rejected
              </span>
            )}
            {!isReady && !isRejected && (
              <span className={cn(
                'text-[11px] font-medium px-2 py-0.5 rounded-full',
                roundStatus === 'preparing' && 'bg-warning/10 text-warning',
                roundStatus === 'confirmed' && 'bg-primary/10 text-primary',
                roundStatus === 'pending' && 'bg-muted text-muted-foreground',
              )}>
                {roundStatus === 'confirmed' ? 'Confirmed' : roundStatus === 'preparing' ? 'Preparing' : 'Pending'}
              </span>
            )}
            {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        <div className={cn(
          'transition-all duration-300',
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100',
        )}>
          <div className="px-4 pb-4 space-y-4">
            {!isRejected && <RoundTimeline status={roundStatus} />}

            {isRejected && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/5">
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">This round was rejected by the kitchen.</p>
              </div>
            )}

            <RoundItems itemsByStatus={itemsByStatus} />

            {round.specialRequest && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-muted/40">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-foreground">{round.specialRequest}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);
OrderRoundSection.displayName = 'OrderRoundSection';

// ── Horizontal Round Timeline ───────────────────────────────────
const RoundTimeline = ({ status }: { status: RoundStatus }) => {
  const currentIndex = ROUND_STATUS_ORDER[status] ?? -1;

  return (
    <div className="flex items-center gap-0">
      {ROUND_TIMELINE.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isActive = index === currentIndex;
        const isLast = index === ROUND_TIMELINE.length - 1;

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500',
                isCompleted && !isActive && 'bg-success',
                isActive && 'bg-primary ring-[3px] ring-primary/20',
                !isCompleted && 'bg-border',
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <span className={cn(
                'text-[10px] mt-1 font-medium',
                isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div className={cn(
                'h-0.5 flex-1 -mx-1 transition-colors duration-500',
                index < currentIndex ? 'bg-success' : 'bg-border',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Round Items ─────────────────────────────────────────────────
interface RoundItemsProps {
  itemsByStatus: Record<string, GroupedOrderItem[]>;
}

const RoundItems = ({ itemsByStatus }: RoundItemsProps) => {
  const statusOrder = ['ready', 'preparing', 'pending', 'rejected'] as const;
  const statusLabels: Record<string, string> = {
    ready: 'Ready',
    preparing: 'Preparing',
    pending: 'Pending',
    rejected: 'Rejected',
  };

  return (
    <div className="space-y-3">
      {statusOrder.map(status => {
        const items = itemsByStatus[status];
        if (!items || items.length === 0) return null;
        const isRejected = status === 'rejected';

        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDotClass[status])} />
              <span className="text-xs font-medium text-muted-foreground">
                {statusLabels[status]} ({items.reduce((s, i) => s + i.count, 0)})
              </span>
            </div>
            <div className="space-y-0.5">
              {items.map((item, idx) => {
                const optionsTotal = item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0;
                const itemTotal = (item.price + optionsTotal) * item.count;

                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start justify-between py-2 px-3 rounded-xl',
                      isRejected ? 'opacity-50' : 'bg-background/60',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium text-foreground', isRejected && 'line-through')}>
                        {item.name}
                      </p>
                      {item.options && item.options.length > 0 && (
                        <div className="mt-0.5">
                          {item.options.map((opt, oidx) => (
                            <p key={oidx} className={cn('text-[11px] text-muted-foreground', isRejected && 'line-through')}>
                              {opt.groupName}: {opt.label}
                              {opt.price !== 0 && <span> ({opt.price > 0 ? '+' : ''}${opt.price.toFixed(2)})</span>}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.count > 1 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Qty: {item.count}</p>
                      )}
                    </div>
                    <span className={cn('text-sm font-semibold text-foreground ml-3 flex-shrink-0', isRejected && 'line-through')}>
                      ${itemTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActiveOrder;

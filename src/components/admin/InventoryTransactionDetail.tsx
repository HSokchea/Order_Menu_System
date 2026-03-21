import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ClipboardList, Package, Trash2, Wrench, RotateCcw, Beaker, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface TransactionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: string;
    type: string;
    quantity: number;
    reference_id: string | null;
    note: string | null;
    created_at: string;
    ingredient_id: string;
    ingredient?: { name: string; unit: string } | null;
  } | null;
}

interface OrderItem {
  item_id: string;
  name: string;
  price: number;
  quantity?: number;
  status: string;
  options?: { groupName: string; label: string; price: number }[];
}

interface IngredientUsage {
  name: string;
  unit: string;
  quantity: number;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  order: { icon: ClipboardList, label: 'Order', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
  order_reversal: { icon: RotateCcw, label: 'Order Reversal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' },
  purchase: { icon: Package, label: 'Purchase', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
  waste: { icon: Trash2, label: 'Waste', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
  adjustment: { icon: Wrench, label: 'Adjustment', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
};

export const InventoryTransactionDetail = ({ open, onOpenChange, transaction }: TransactionDetailProps) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<{
    items: OrderItem[];
    status: string;
    table_id: string | null;
    total_usd: number;
    created_at: string;
    order_type: string | null;
  } | null>(null);
  const [ingredientUsage, setIngredientUsage] = useState<IngredientUsage[]>([]);
  const [allTransactions, setAllTransactions] = useState<{ ingredient_name: string; unit: string; quantity: number }[]>([]);

  useEffect(() => {
    if (!open || !transaction) {
      setOrderData(null);
      setIngredientUsage([]);
      setAllTransactions([]);
      return;
    }

    if (transaction.type === 'order' || transaction.type === 'order_reversal') {
      fetchOrderDetail(transaction.reference_id);
    } else if (transaction.reference_id) {
      fetchRelatedTransactions(transaction.reference_id, transaction.type);
    }
  }, [open, transaction]);

  const fetchOrderDetail = async (orderId: string | null) => {
    if (!orderId) return;
    setLoading(true);

    try {
      // Fetch order from tb_order_temporary first, then tb_his_admin
      let orderResult = await supabase
        .from('tb_order_temporary')
        .select('items, status, table_id, total_usd, created_at, order_type')
        .eq('id', orderId)
        .maybeSingle();

      if (!orderResult.data) {
        orderResult = await supabase
          .from('tb_his_admin')
          .select('items, status, table_id, total_usd, created_at, order_type')
          .eq('id', orderId)
          .maybeSingle();
        
        // Also try original_order_id
        if (!orderResult.data) {
          orderResult = await supabase
            .from('tb_his_admin')
            .select('items, status, table_id, total_usd, created_at, order_type')
            .eq('original_order_id', orderId)
            .maybeSingle();
        }
      }

      if (orderResult.data) {
        const items = (orderResult.data.items as OrderItem[]) || [];
        setOrderData({
          items,
          status: orderResult.data.status,
          table_id: orderResult.data.table_id,
          total_usd: orderResult.data.total_usd || 0,
          created_at: orderResult.data.created_at,
          order_type: orderResult.data.order_type,
        });
      }

      // Fetch all inventory transactions for this order reference
      const { data: txns } = await supabase
        .from('inventory_transactions')
        .select('quantity, ingredient:ingredients(name, unit)')
        .eq('reference_id', orderId);

      if (txns) {
        const usageMap = new Map<string, IngredientUsage>();
        txns.forEach((tx: any) => {
          const ing = Array.isArray(tx.ingredient) ? tx.ingredient[0] : tx.ingredient;
          if (!ing) return;
          const key = ing.name;
          const existing = usageMap.get(key);
          if (existing) {
            existing.quantity += tx.quantity;
          } else {
            usageMap.set(key, { name: ing.name, unit: ing.unit, quantity: tx.quantity });
          }
        });
        setIngredientUsage(Array.from(usageMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (e) {
      console.error('Failed to fetch order detail', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedTransactions = async (refId: string, type: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('inventory_transactions')
        .select('quantity, ingredient:ingredients(name, unit)')
        .eq('reference_id', refId)
        .eq('type', type);

      if (data) {
        setAllTransactions(data.map((tx: any) => {
          const ing = Array.isArray(tx.ingredient) ? tx.ingredient[0] : tx.ingredient;
          return { ingredient_name: ing?.name || '—', unit: ing?.unit || '', quantity: tx.quantity };
        }));
      }
    } catch (e) {
      console.error('Failed to fetch related transactions', e);
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  const typeConfig = TYPE_CONFIG[transaction.type] || TYPE_CONFIG.adjustment;
  const Icon = typeConfig.icon;
  const shortId = transaction.reference_id?.substring(0, 8).toUpperCase();

  const content = (
    <div className="space-y-5 px-1">
      {/* Transaction Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <Badge variant="secondary" className={cn('text-xs', typeConfig.color)}>
              {typeConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(transaction.created_at), 'MMM d, yyyy · h:mm a')}
          </p>
        </div>
        <div className={cn(
          'text-right font-mono text-lg font-bold',
          transaction.quantity > 0 ? 'text-green-600' : 'text-destructive'
        )}>
          {transaction.quantity > 0 ? '+' : ''}{transaction.quantity} {transaction.ingredient?.unit}
        </div>
      </div>

      {/* Ingredient */}
      <div className="rounded-lg border p-3 space-y-1">
        <p className="text-xs text-muted-foreground">Ingredient</p>
        <p className="font-medium">{transaction.ingredient?.name || '—'}</p>
      </div>

      {/* Note */}
      {transaction.note && (
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Note</p>
          <p className="text-sm">{transaction.note}</p>
        </div>
      )}

      <Separator />

      {/* Order-specific details */}
      {(transaction.type === 'order' || transaction.type === 'order_reversal') && (
        loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : orderData ? (
          <div className="space-y-4">
            {/* Order Info */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Order #{shortId}</p>
                <Badge variant="secondary" className="text-xs capitalize">{orderData.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Type: </span>
                  <span className="capitalize">{orderData.order_type?.replace('_', ' ') || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-medium">${orderData.total_usd.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Order Items grouped by round */}
            {orderData.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Order Items
                </p>
                <div className="rounded-lg border divide-y">
                  {orderData.items.map((item, idx) => (
                    <div key={idx} className="px-3 py-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {item.quantity && item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">${item.price?.toFixed(2)}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{item.status}</Badge>
                        </div>
                      </div>
                      {item.options && item.options.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.options.map((opt, oi) => (
                            <span key={oi} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {opt.groupName}: {opt.label}
                              {opt.price > 0 && ` (+$${opt.price.toFixed(2)})`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredient Consumption */}
            {ingredientUsage.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Beaker className="h-3.5 w-3.5" /> Ingredient Consumption
                </p>
                <div className="rounded-lg border divide-y">
                  {ingredientUsage.map((usage, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{usage.name}</span>
                      <span className={cn(
                        'font-mono font-medium',
                        usage.quantity > 0 ? 'text-green-600' : 'text-destructive'
                      )}>
                        {usage.quantity > 0 ? '+' : ''}{usage.quantity} {usage.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Order details not found
          </p>
        )
      )}

      {/* Non-order with shared reference */}
      {transaction.type !== 'order' && transaction.type !== 'order_reversal' && allTransactions.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Related Adjustments</p>
          <div className="rounded-lg border divide-y">
            {allTransactions.map((tx, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{tx.ingredient_name}</span>
                <span className={cn(
                  'font-mono font-medium',
                  tx.quantity > 0 ? 'text-green-600' : 'text-destructive'
                )}>
                  {tx.quantity > 0 ? '+' : ''}{tx.quantity} {tx.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Transaction Detail</DrawerTitle>
            <DrawerDescription className="sr-only">Details of inventory transaction</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transaction Detail</SheetTitle>
          <SheetDescription className="sr-only">Details of inventory transaction</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {content}
        </div>
      </SheetContent>
    </Sheet>
  );
};

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Store, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { StoredOrderItem, groupItemsIntoRounds } from '@/types/order';

interface CustomerOrder {
  id: string;
  shop_id: string;
  device_id: string;
  status: string;
  total_usd: number;
  customer_notes: string | null;
  items: StoredOrderItem[];
  order_type: string;
  table_id: string | null;
  table_number?: string;
  created_at: string;
  updated_at: string;
}

interface OrderCardProps {
  order: CustomerOrder;
  onClick: () => void;
}

// Calculate status counts from items
function getStatusCounts(items: StoredOrderItem[]) {
  const counts = { pending: 0, preparing: 0, ready: 0, rejected: 0 };
  items.forEach(item => {
    const status = item.status || 'pending';
    if (status in counts) {
      counts[status as keyof typeof counts]++;
    }
  });
  return counts;
}

const OrderCard = ({ order, onClick }: OrderCardProps) => {
  const isDineIn = order.order_type === 'dine_in';
  const orderTime = formatDistanceToNow(new Date(order.updated_at), { addSuffix: true });
  
  // Calculate rounds
  const rounds = groupItemsIntoRounds(order.items, order.customer_notes);
  const itemCount = order.items.length;
  const roundCount = rounds.length;
  
  // Calculate status counts
  const statusCounts = getStatusCounts(order.items);

  // Get status badge variant
  const getStatusBadge = () => {
    switch (order.status) {
      case 'placed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">PLACED</Badge>;
      case 'preparing':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">PREPARING</Badge>;
      case 'ready':
        return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">READY</Badge>;
      default:
        return <Badge variant="outline">{order.status.toUpperCase()}</Badge>;
    }
  };

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
        isDineIn ? 'border-l-primary' : 'border-l-green-500'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              {isDineIn ? (
                <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Store className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base">
                {isDineIn ? `Table ${order.table_number || 'N/A'}` : 'Takeaway'}
                <span className="ml-2 text-xs font-mono text-muted-foreground">
                  #{order.created_at.replace(/\D/g, '').slice(-4)}
                </span>
              </h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last order {orderTime}
              </div>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Items & Rounds Info */}
        <div className="text-sm text-muted-foreground mb-2">
          {itemCount} Items • {roundCount} Round{roundCount !== 1 ? 's' : ''}
        </div>

        {/* Status Counts */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {statusCounts.pending > 0 && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
              {statusCounts.pending} pending
            </Badge>
          )}
          {statusCounts.preparing > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              {statusCounts.preparing} preparing
            </Badge>
          )}
          {statusCounts.ready > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              {statusCounts.ready} ready
            </Badge>
          )}
          {statusCounts.rejected > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
              {statusCounts.rejected} rejected
            </Badge>
          )}
        </div>

        {/* Separator */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Amount
            </span>
            <span className="text-xl font-bold">
              ${order.total_usd?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderCard;

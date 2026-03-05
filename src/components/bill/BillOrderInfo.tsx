import { format } from 'date-fns';
import type { ActiveOrder } from '@/types/order';

interface BillOrderInfoProps {
  order: ActiveOrder;
}

const BillOrderInfo = ({ order }: BillOrderInfoProps) => {
  const formatOrderType = (type: string) => {
    switch (type) {
      case 'dine_in': return 'Dine In';
      case 'takeaway': return 'Takeaway';
      default: return type;
    }
  };

  return (
    <div className="text-sm space-y-1 my-4" style={{ color: '#444' }}>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Table</span>
        <span>{order.table_number || 'N/A'}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Type</span>
        <span>{formatOrderType(order.order_type)}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Date</span>
        <span>{format(new Date(order.created_at), 'MMM d, yyyy')}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Time</span>
        <span>{format(new Date(order.created_at), 'h:mm a')}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Order ID</span>
        <span>#{order.id.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  );
};

export default BillOrderInfo;

import { format } from 'date-fns';
import type { ReceiptSession } from './SessionReceipt';

interface ReceiptOrderInfoProps {
  session: ReceiptSession;
}

const formatOrderType = (type?: string) => {
  switch (type) {
    case 'dine_in': return 'Dine In';
    case 'takeaway': return 'Takeaway';
    case 'delivery': return 'Delivery';
    default: return 'Dine In';
  }
};

const getShortId = (session: ReceiptSession): string => {
  // Derive short ID from session_id last 4 chars
  const match = session.started_at.match(/\.(\d+)/);
  return match ? `#${match[1].slice(-4)}` : `#${session.session_id.slice(-4)}`;
};

const ReceiptOrderInfo = ({ session }: ReceiptOrderInfoProps) => {
  const shortId = getShortId(session);

  return (
    <div className="text-sm space-y-1 my-4" style={{ color: '#444' }}>
      {session.invoice_number && (
        <div className="flex justify-between">
          <span style={{ color: '#888' }}>Invoice</span>
          <span>{session.invoice_number}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Table</span>
        <span>{session.table_number || 'N/A'}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Type</span>
        <span>{formatOrderType(session.order_type)}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Date</span>
        <span>{format(new Date(session.started_at), 'MMM d, yyyy')}</span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Time</span>
        <span>
          {format(new Date(session.started_at), 'h:mm a')}
          {session.ended_at && ` – ${format(new Date(session.ended_at), 'h:mm a')}`}
        </span>
      </div>
      <div className="flex justify-between">
        <span style={{ color: '#888' }}>Order ID</span>
        <span>{shortId}</span>
      </div>
    </div>
  );
};

export default ReceiptOrderInfo;

import { format } from 'date-fns';
import { Check } from 'lucide-react';
import type { ReceiptSession } from './SessionReceipt';

interface ReceiptFooterProps {
  session: ReceiptSession;
}

const ReceiptFooter = ({ session }: ReceiptFooterProps) => {
  return (
    <>
      {/* Payment status */}
      <div className="border-t" style={{ borderColor: '#ddd' }} />
      <div className="text-center">
        {session.status === 'paid' ? (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 font-semibold text-base" style={{ color: '#16a34a' }}>
              <Check className="h-4 w-4" strokeWidth={3} />
              <span>PAID</span>
            </div>

            {session.cashier_name && (
              <p className="text-xs" style={{ color: '#666' }}>
                Cashier: {session.cashier_name}
              </p>
            )}

            {session.ended_at && (
              <p className="text-xs" style={{ color: '#999' }}>
                {format(new Date(session.ended_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
        ) : (
          <span className="font-semibold text-base tracking-wide" style={{ color: '#666' }}>
            UNPAID
          </span>
        )}
      </div>

      {/* Footer message */}
      <div className="border-t mt-1 pt-4" style={{ borderColor: '#ddd' }} />
      <div className="text-center text-xs space-y-0.5" style={{ color: '#999' }}>
        <p>{session.receipt_footer_text || 'Thank you for dining with us!'}</p>
      </div>
    </>
  );
};

export default ReceiptFooter;

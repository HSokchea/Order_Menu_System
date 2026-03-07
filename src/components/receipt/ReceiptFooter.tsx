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
      <div style={{ borderTop: '1px solid #ddd', marginTop: '16px', paddingTop: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          {session.status === 'paid' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div className="inline-flex items-center gap-1.5 font-semibold text-base" style={{ color: '#16a34a' }}>
                <Check className="h-4 w-4" strokeWidth={3} />
                <span>PAID</span>
              </div>

              {session.cashier_name && (
                <p style={{ fontSize: '12px', color: '#666' }}>
                  Cashier: {session.cashier_name}
                </p>
              )}

              {session.ended_at && (
                <p style={{ fontSize: '12px', color: '#999' }}>
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
      </div>

      {/* Footer message */}
      <div style={{ borderTop: '1px solid #ddd', marginTop: '16px', paddingTop: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#999' }}>
          {session.receipt_footer_text || 'Thank you for dining with us!'}
        </p>
      </div>
    </>
  );
};

export default ReceiptFooter;

import { format } from 'date-fns';
import type { ReceiptSession } from './SessionReceipt';

interface ReceiptFooterProps {
  session: ReceiptSession;
}

const ReceiptFooter = ({ session }: ReceiptFooterProps) => {
  return (
    <>
      {/* Payment status - all inline styles for html2canvas/PDF consistency */}
      <div style={{
        borderTop: '1px dashed #ccc',
        marginTop: '16px',
        paddingTop: '16px',
        textAlign: 'center',
      }}>
        {session.status === 'paid' ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              fontSize: '14px',
              color: '#16a34a',
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>PAID</span>
            </div>

            {session.cashier_name && (
              <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                Cashier: {session.cashier_name}
              </p>
            )}

            {session.ended_at && (
              <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
                {format(new Date(session.ended_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
        ) : (
          <span style={{
            fontWeight: 600,
            fontSize: '14px',
            letterSpacing: '0.025em',
            color: '#666',
          }}>
            UNPAID
          </span>
        )}
      </div>

      {/* Footer message */}
      <div style={{
        borderTop: '1px dashed #ccc',
        marginTop: '16px',
        paddingTop: '16px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
          {session.receipt_footer_text || 'Thank you for dining with us!'}
        </p>
      </div>
    </>
  );
};

export default ReceiptFooter;

import type { ReceiptSession } from './SessionReceipt';

interface ReceiptHeaderProps {
  session: ReceiptSession;
}

const ReceiptHeader = ({ session }: ReceiptHeaderProps) => {
  const addressParts = [session.restaurant_address, session.restaurant_city].filter(Boolean);
  const addressLine = addressParts.join(', ');

  return (
    <div className="text-center mb-1">
      {session.restaurant_logo_url && (
        <div className="receipt-logo flex justify-center mb-2">
          <img
            src={session.restaurant_logo_url}
            alt="Restaurant Logo"
            className="h-14 w-14 rounded-full object-cover border"
            style={{ borderColor: '#ddd' }}
          />
        </div>
      )}

      <h1 className="font-semibold text-lg" style={{ color: '#111' }}>
        {session.restaurant_name}
      </h1>

      {session.receipt_header_text && (
        <p className="text-xs mt-0.5" style={{ color: '#666' }}>
          {session.receipt_header_text}
        </p>
      )}

      {addressLine && (
        <p className="text-xs mt-0.5" style={{ color: '#666' }}>
          {addressLine}
        </p>
      )}

      {session.restaurant_phone && (
        <p className="text-xs" style={{ color: '#666' }}>
          {session.restaurant_phone}
        </p>
      )}

      {session.restaurant_vat_tin && (
        <p className="text-xs mt-0.5" style={{ color: '#666' }}>
          VAT TIN: {session.restaurant_vat_tin}
        </p>
      )}

      <div className="border-t mt-4 mb-0" style={{ borderColor: '#ddd' }} />
    </div>
  );
};

export default ReceiptHeader;

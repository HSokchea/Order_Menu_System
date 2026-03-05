import { Check } from 'lucide-react';
import type { ShopInfo } from '@/types/order';

interface BillFooterProps {
  isPaid: boolean;
  shop: ShopInfo | null;
}

const BillFooter = ({ isPaid, shop }: BillFooterProps) => {
  return (
    <>
      {/* Payment status */}
      <div className="border-t my-1" style={{ borderColor: '#ddd' }} />
      <div className="text-center py-0">
        {isPaid ? (
          <div className="inline-flex items-center gap-1.5 font-semibold text-base" style={{ color: '#16a34a' }}>
            <Check className="h-4 w-4" strokeWidth={3} />
            <span>PAID</span>
          </div>
        ) : (
          <span className="font-semibold text-base tracking-wide" style={{ color: '#666' }}>
            UNPAID
          </span>
        )}
      </div>

      {/* Footer message */}
      {shop?.receipt_footer_text && (
        <>
          <div
            className="border-t mt-1 pt-4"
            style={{ borderColor: '#ddd' }}
          />
          <div
            className="text-center text-xs space-y-0.5"
            style={{ color: '#999' }}
          >
            <p>{shop.receipt_footer_text}</p>
          </div>
        </>
      )}
    </>
  );
};

export default BillFooter;

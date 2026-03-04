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
      <div className="border-t my-4" style={{ borderColor: '#ddd' }} />
      <div className="text-center py-2">
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
      <div className="border-t mt-4 pt-4" style={{ borderColor: '#ddd' }} />
      <div className="text-center text-xs space-y-0.5" style={{ color: '#999' }}>
        <p>{shop?.receipt_footer_text || 'Thank you for your visit'}</p>
        <p>Please come again</p>
      </div>
    </>
  );
};

export default BillFooter;

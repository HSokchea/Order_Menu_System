import type { ShopInfo } from '@/types/order';

interface BillHeaderProps {
  shop: ShopInfo | null;
}

const BillHeader = ({ shop }: BillHeaderProps) => {
  if (!shop) return null;

  const addressParts = [shop.address, shop.city, shop.country].filter(Boolean);
  const addressLine = addressParts.join(', ');

  return (
    <div className="text-center mb-1">
      {shop.logo_url && (
        <div className="flex justify-center mb-2">
          <img
            src={shop.logo_url}
            alt={shop.name}
            className="h-14 w-14 rounded-full object-cover border"
            style={{ borderColor: '#ddd' }}
          />
        </div>
      )}

      <h1 className="font-semibold text-lg" style={{ color: '#111' }}>
        {shop.name}
      </h1>

      {shop.receipt_header_text && (
        <p className="text-xs mt-0.5" style={{ color: '#666' }}>
          {shop.receipt_header_text}
        </p>
      )}

      {addressLine && (
        <p className="text-xs mt-0.5" style={{ color: '#666' }}>
          {addressLine}
        </p>
      )}

      {shop.phone && (
        <p className="text-xs" style={{ color: '#666' }}>
          {shop.phone}
        </p>
      )}

      {shop.vat_tin && (
        <p className="text-xs mt-0.5" style={{ color: '#666' }}>
          VAT TIN: {shop.vat_tin}
        </p>
      )}

      <div className="border-t mt-4 mb-0" style={{ borderColor: '#ddd' }} />
    </div>
  );
};

export default BillHeader;

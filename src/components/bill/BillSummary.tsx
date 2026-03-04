import { convertUSDtoKHR, formatKHR } from '@/lib/amountInWords';
import type { ShopInfo } from '@/types/order';

interface BillSummaryProps {
  subtotal: number;
  shop: ShopInfo | null;
  formatPrice: (amount: number) => string;
}

const BillSummary = ({ subtotal, shop, formatPrice }: BillSummaryProps) => {
  const taxRate = shop?.default_tax_percentage || 0;
  const serviceRate = shop?.service_charge_percentage || 0;
  const exchangeRate = shop?.exchange_rate_usd_to_khr || 4100;

  const taxAmount = subtotal * (taxRate / 100);
  const serviceAmount = subtotal * (serviceRate / 100);
  const grandTotal = subtotal + taxAmount + serviceAmount;
  const khrTotal = convertUSDtoKHR(grandTotal, exchangeRate);

  return (
    <div className="my-4">
      <div className="border-t mb-3" style={{ borderColor: '#ddd' }} />

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between" style={{ color: '#444' }}>
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>

        {taxRate > 0 && (
          <div className="flex justify-between" style={{ color: '#888' }}>
            <span>Tax ({taxRate}%)</span>
            <span className="tabular-nums">{formatPrice(taxAmount)}</span>
          </div>
        )}

        {serviceRate > 0 && (
          <div className="flex justify-between" style={{ color: '#888' }}>
            <span>Service Charge ({serviceRate}%)</span>
            <span className="tabular-nums">{formatPrice(serviceAmount)}</span>
          </div>
        )}

        {/* Grand total */}
        <div className="border-t pt-2 mt-2" style={{ borderColor: '#ddd' }}>
          <div className="flex justify-between font-semibold text-base" style={{ color: '#111' }}>
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(grandTotal)}</span>
          </div>

          <div className="flex justify-between font-semibold text-base mt-1" style={{ color: '#111' }}>
            <span>សរុប</span>
            <span className="tabular-nums">{formatKHR(khrTotal)}</span>
          </div>
        </div>

        <p className="text-xs text-center mt-1" style={{ color: '#aaa' }}>
          Rate: 1 USD = {exchangeRate.toLocaleString()} KHR
        </p>
      </div>
    </div>
  );
};

export default BillSummary;

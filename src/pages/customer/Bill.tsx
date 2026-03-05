import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';
import { useActiveOrder } from '@/hooks/useActiveOrder';
import { calculateOrderTotal } from '@/types/order';
import StickyHeader from '@/components/customer/StickyHeader';
import BillHeader from '@/components/bill/BillHeader';
import BillOrderInfo from '@/components/bill/BillOrderInfo';
import BillItemsSection from '@/components/bill/BillItemsSection';
import BillSummary from '@/components/bill/BillSummary';
import BillFooter from '@/components/bill/BillFooter';

const Bill = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table_id');

  const { order, shop, isLoading } = useActiveOrder(shopId);

  const menuUrl = tableId ? `/menu/${shopId}?table_id=${tableId}` : `/menu/${shopId}`;
  const orderUrl = tableId ? `/menu/${shopId}/order?table_id=${tableId}` : `/menu/${shopId}/order`;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: '#999' }}>Loading...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white">
        <StickyHeader backUrl={menuUrl} title="Bill" />
        <main className="container mx-auto px-4 py-12 text-center">
          <Receipt className="h-14 w-14 mx-auto mb-3" style={{ color: '#ccc' }} />
          <h2 className="text-lg font-semibold" style={{ color: '#333' }}>No Bill Available</h2>
          <p className="text-sm mb-4" style={{ color: '#999' }}>Place an order to view your bill.</p>
          <Button variant="secondary" asChild size="sm" className="rounded-full px-4">
            <Link to={menuUrl}>Back to Menu</Link>
          </Button>
        </main>
      </div>
    );
  }

  const subtotal = calculateOrderTotal(order.items);
  const isPaid = order.status === 'paid';

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <StickyHeader backUrl={orderUrl} title="Bill" className="print:hidden" />

      <main className="max-w-md mx-auto px-4 py-6 print:px-3 print:py-4 print:max-w-none print:mx-0">
        <BillHeader shop={shop} />
        <BillOrderInfo order={order} />

        <div className="border-t" style={{ borderColor: '#ddd' }} />

        <BillItemsSection items={order.items} formatPrice={formatPrice} />
        <BillSummary subtotal={subtotal} shop={shop} formatPrice={formatPrice} />
        <BillFooter isPaid={isPaid} shop={shop} />
      </main>

      {/* Actions — hidden in print */}
      <div className="max-w-md mx-auto px-4 pb-8 flex gap-2 print:hidden">
        <Button
          className="flex-1 rounded-xl"
          size="sm"
          asChild
        >
          <Link to={orderUrl}>Back to Order Status</Link>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="flex-1 rounded-xl bg-muted"
          asChild
        >
          <Link to={menuUrl}>Order More Items</Link>
        </Button>
      </div>
    </div>
  );
};

export default Bill;

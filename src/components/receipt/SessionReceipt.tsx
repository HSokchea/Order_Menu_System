import { forwardRef } from 'react';
import ReceiptHeader from './ReceiptHeader';
import ReceiptOrderInfo from './ReceiptOrderInfo';
import ReceiptItemsSection from './ReceiptItemsSection';
import ReceiptSummary from './ReceiptSummary';
import ReceiptFooter from './ReceiptFooter';

export interface OrderItem {
  id: string;
  quantity: number;
  price_usd: number;
  notes: string | null;
  menu_item_name: string;
}

export interface SessionOrder {
  id: string;
  total_usd: number;
  status: string;
  created_at: string;
  customer_notes: string | null;
  items: OrderItem[];
}

export interface ReceiptSession {
  session_id: string;
  table_id: string;
  table_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_phone?: string | null;
  restaurant_address?: string | null;
  restaurant_city?: string | null;
  restaurant_country?: string | null;
  restaurant_logo_url?: string | null;
  restaurant_vat_tin?: string | null;
  default_tax_percentage?: number;
  service_charge_percentage?: number;
  exchange_rate_usd_to_khr?: number;
  exchange_rate_at_payment?: number | null;
  show_tax_on_receipt?: boolean;
  show_service_charge_on_receipt?: boolean;
  currency?: string;
  receipt_header_text?: string | null;
  receipt_footer_text?: string | null;
  status: 'open' | 'paid';
  started_at: string;
  ended_at: string | null;
  total_amount: number;
  order_type?: string;
  invoice_number?: string | null;
  cashier_name?: string | null;
  orders: SessionOrder[];
}

interface SessionReceiptProps {
  session: ReceiptSession;
  showActions?: boolean;
  isPrintMode?: boolean;
}

const getSessionSubtotal = (session: ReceiptSession): number => {
  return session.orders.reduce((sum, order) => {
    if (order.status !== 'rejected') {
      return sum + order.total_usd;
    }
    return sum;
  }, 0);
};

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);

export const SessionReceipt = forwardRef<HTMLDivElement, SessionReceiptProps>(
  ({ session }, ref) => {
    const subtotal = getSessionSubtotal(session);

    return (
      <div
        ref={ref}
        className="bg-white max-w-sm mx-auto px-6 py-8 print:w-[80mm] print:px-3 print:py-4 print:max-w-none print:mx-0"
        style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
      >
        <ReceiptHeader session={session} />
        <ReceiptOrderInfo session={session} />

        <div className="border-t" style={{ borderColor: '#ddd' }} />

        <ReceiptItemsSection session={session} formatPrice={formatPrice} />
        <ReceiptSummary session={session} subtotal={subtotal} formatPrice={formatPrice} />
        <ReceiptFooter session={session} />
      </div>
    );
  }
);

SessionReceipt.displayName = 'SessionReceipt';

export default SessionReceipt;

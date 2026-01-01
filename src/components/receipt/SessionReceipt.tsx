import { forwardRef } from 'react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock } from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  price_usd: number;
  notes: string | null;
  menu_item_name: string;
}

interface SessionOrder {
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
  currency?: string;
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

const parseItemOptions = (notes: string | null): Array<{ group: string; value: string; price: number }> => {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    if (parsed.selectedOptions && Array.isArray(parsed.selectedOptions)) {
      return parsed.selectedOptions;
    }
    if (parsed.size) {
      return [{ group: 'Size', value: parsed.size, price: 0 }];
    }
  } catch {
    // Not JSON, return empty
  }
  return [];
};

const getSessionTotal = (session: ReceiptSession): number => {
  return session.orders.reduce((sum, order) => {
    if (order.status !== 'rejected') {
      return sum + order.total_usd;
    }
    return sum;
  }, 0);
};

export const SessionReceipt = forwardRef<HTMLDivElement, SessionReceiptProps>(
  ({ session, showActions = false, isPrintMode = false }, ref) => {
    const totalBill = getSessionTotal(session);
    const taxRate = session.default_tax_percentage || 0;
    const serviceChargeRate = session.service_charge_percentage || 0;
    const taxAmount = totalBill * (taxRate / 100);
    const serviceChargeAmount = totalBill * (serviceChargeRate / 100);
    const grandTotal = totalBill + taxAmount + serviceChargeAmount;
    const currency = session.currency || 'USD';

    const formatPrice = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(amount);
    };

    const formatOrderType = (type?: string) => {
      switch (type) {
        case 'dine_in': return 'Dine In';
        case 'takeaway': return 'Takeaway';
        case 'delivery': return 'Delivery';
        default: return 'Dine In';
      }
    };

    // Build address line
    const addressParts = [session.restaurant_address, session.restaurant_city, session.restaurant_country].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    return (
      <div
        ref={ref}
        className={`
          bg-white text-black
          ${isPrintMode ? 'w-[80mm] p-2 text-xs' : 'max-w-md mx-auto p-6'}
          font-mono
          print:w-[80mm] print:p-2 print:text-[10px] print:max-w-none print:mx-0
        `}
      >
        {/* Header */}
        <div className="text-center mb-4 print:mb-2">
          {session.restaurant_logo_url && (
            <div className="flex justify-center mb-3 print:mb-2">
              <img 
                src={session.restaurant_logo_url} 
                alt={session.restaurant_name}
                className={`object-contain ${isPrintMode ? 'h-12 w-12' : 'h-16 w-16'} print:h-12 print:w-12 rounded-lg`}
              />
            </div>
          )}
          <h1 className={`font-bold ${isPrintMode ? 'text-sm' : 'text-xl'} print:text-sm`}>
            {session.restaurant_name}
          </h1>
          {fullAddress && (
            <p className="text-muted-foreground print:text-black/70 text-xs mt-1">
              {fullAddress}
            </p>
          )}
          {session.restaurant_phone && (
            <p className="text-muted-foreground print:text-black/70 text-xs">
              Tel: {session.restaurant_phone}
            </p>
          )}
          {session.restaurant_vat_tin && (
            <p className="text-muted-foreground print:text-black/70 text-xs">
              VAT TIN: {session.restaurant_vat_tin}
            </p>
          )}
        </div>

        <Separator className="my-3 print:my-1 print:border-dashed" />

        {/* Session Info */}
        <div className="space-y-1 text-center mb-4 print:mb-2">
          {session.invoice_number && (
            <p className="font-semibold text-sm">
              Invoice: {session.invoice_number}
            </p>
          )}
          <p className="text-muted-foreground print:text-black/70">
            Table {session.table_number} • {formatOrderType(session.order_type)}
          </p>
          <p className="text-muted-foreground print:text-black/70">
            {format(new Date(session.started_at), 'MMM d, yyyy')}
          </p>
          <p className="text-muted-foreground print:text-black/70">
            Started: {format(new Date(session.started_at), 'h:mm a')}
          </p>
          {session.ended_at && (
            <p className="text-muted-foreground print:text-black/70">
              Ended: {format(new Date(session.ended_at), 'h:mm a')}
            </p>
          )}
          {!session.invoice_number && (
            <p className={`text-[10px] text-muted-foreground print:text-black/50 ${isPrintMode ? '' : 'text-xs'}`}>
              Session: {session.session_id.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>

        <Separator className="my-3 print:my-1 print:border-dashed" />

        {/* Orders Section */}
        <div className="space-y-4 print:space-y-2">
          {session.orders.map((order, orderIndex) => (
            <div key={order.id} className="space-y-2 print:space-y-1">
              {/* Order Header */}
              <div className="flex justify-between items-center">
                <span className="font-semibold">
                  Order #{orderIndex + 1}
                </span>
                <span className="text-muted-foreground print:text-black/70">
                  {format(new Date(order.created_at), 'h:mm a')}
                </span>
              </div>

              {/* Order Items */}
              {order.items.map((item) => {
                const options = parseItemOptions(item.notes);
                const itemTotal = item.price_usd * item.quantity;

                return (
                  <div key={item.id} className="pl-2 print:pl-1">
                    <div className="flex justify-between">
                      <div className="flex-1">
                        <span>{item.quantity}x {item.menu_item_name}</span>
                      </div>
                      <span className="font-medium ml-2">
                        {formatPrice(itemTotal)}
                      </span>
                    </div>

                    {/* Options */}
                    {options.length > 0 && (
                      <div className="text-muted-foreground print:text-black/60 pl-3 print:pl-2">
                        {options.map((opt, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>• {opt.group}: {opt.value}</span>
                            {opt.price > 0 && (
                              <span>+{formatPrice(opt.price)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Order Subtotal */}
              <div className="flex justify-between pl-2 print:pl-1 text-muted-foreground print:text-black/70">
                <span>Order subtotal</span>
                <span>{formatPrice(order.total_usd)}</span>
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-4 print:my-2 print:border-dashed" />

        {/* Summary Section */}
        <div className="space-y-2 print:space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPrice(totalBill)}</span>
          </div>
          
          {taxRate > 0 && (
            <div className="flex justify-between text-muted-foreground print:text-black/70">
              <span>Tax ({taxRate}%)</span>
              <span>{formatPrice(taxAmount)}</span>
            </div>
          )}
          
          {serviceChargeRate > 0 && (
            <div className="flex justify-between text-muted-foreground print:text-black/70">
              <span>Service Charge ({serviceChargeRate}%)</span>
              <span>{formatPrice(serviceChargeAmount)}</span>
            </div>
          )}
          
          {/* Total */}
          <div className={`flex justify-between font-bold ${isPrintMode ? 'text-sm' : 'text-lg'} print:text-sm pt-2 border-t border-dashed`}>
            <span>TOTAL</span>
            <span>{formatPrice(grandTotal)}</span>
          </div>
        </div>

        <Separator className="my-4 print:my-2 print:border-dashed" />

        {/* Payment Status */}
        <div className="text-center space-y-2 print:space-y-1">
          {session.status === 'paid' ? (
            <>
              <div className="flex items-center justify-center gap-2 text-green-600 print:text-black">
                <CheckCircle className="h-4 w-4 print:h-3 print:w-3" />
                <span className="font-semibold">PAID</span>
              </div>
              {session.cashier_name && (
                <p className="text-muted-foreground print:text-black/70 text-xs">
                  Cashier: {session.cashier_name}
                </p>
              )}
              {session.ended_at && (
                <p className="text-muted-foreground print:text-black/70">
                  {format(new Date(session.ended_at), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-orange-600 print:text-black">
              <Clock className="h-4 w-4 print:h-3 print:w-3" />
              <span className="font-semibold">UNPAID</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 print:mt-3 text-muted-foreground print:text-black/70">
          <p>Thank you for dining with us!</p>
          <p className={`mt-2 ${isPrintMode ? 'text-[8px]' : 'text-xs'} print:text-[8px]`}>
            {format(new Date(), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>
    );
  }
);

SessionReceipt.displayName = 'SessionReceipt';

export default SessionReceipt;

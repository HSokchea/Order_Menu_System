import { forwardRef } from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { 
  numberToWordsEnglish, 
  numberToWordsKhmer, 
  convertUSDtoKHR, 
  formatKHR 
} from '@/lib/amountInWords';

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
  exchange_rate_usd_to_khr?: number;
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

interface ParsedOption {
  group: string;
  value: string;
  price: number;
}

interface ParsedItemData {
  size?: string;
  options: ParsedOption[];
}

const parseItemNotes = (notes: string | null): ParsedItemData => {
  if (!notes) return { options: [] };
  try {
    const parsed = JSON.parse(notes);
    const result: ParsedItemData = { options: [] };
    
    // Check for explicit size field first
    if (parsed.size) {
      result.size = parsed.size;
    }
    
    if (parsed.selectedOptions && Array.isArray(parsed.selectedOptions)) {
      // Separate size from options - size entries typically have group "Size" or single letter values like "S", "M", "L", "XL"
      const sizePattern = /^(S|M|L|XL|XXL|Small|Medium|Large|Extra Large)$/i;
      
      result.options = parsed.selectedOptions.filter((opt: ParsedOption) => {
        // If it's a size option, extract it as the size
        if (opt.group?.toLowerCase() === 'size' || sizePattern.test(opt.value)) {
          if (!result.size) {
            result.size = opt.value;
          }
          return false; // Remove from options list
        }
        return true;
      });
    }
    
    return result;
  } catch {
    return { options: [] };
  }
};

const getSessionTotal = (session: ReceiptSession): number => {
  return session.orders.reduce((sum, order) => {
    if (order.status !== 'rejected') {
      return sum + order.total_usd;
    }
    return sum;
  }, 0);
};

// Flatten all items from all orders for single display
const getAllItems = (orders: SessionOrder[]): Array<OrderItem & { orderId: string }> => {
  return orders
    .filter(order => order.status !== 'rejected')
    .flatMap(order => 
      order.items.map(item => ({ ...item, orderId: order.id }))
    );
};

export const SessionReceipt = forwardRef<HTMLDivElement, SessionReceiptProps>(
  ({ session, isPrintMode = false }, ref) => {
    const totalBill = getSessionTotal(session);
    const taxRate = session.default_tax_percentage || 0;
    const serviceChargeRate = session.service_charge_percentage || 0;
    const taxAmount = totalBill * (taxRate / 100);
    const serviceChargeAmount = totalBill * (serviceChargeRate / 100);
    const grandTotal = totalBill + taxAmount + serviceChargeAmount;
    const currency = session.currency || 'USD';
    const exchangeRate = session.exchange_rate_usd_to_khr || 4100;
    
    // Calculate KHR amounts
    const grandTotalKHR = convertUSDtoKHR(grandTotal, exchangeRate);

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

    // Build single-line address
    const addressParts = [session.restaurant_address, session.restaurant_city].filter(Boolean);
    const addressLine = addressParts.join(', ');

    const allItems = getAllItems(session.orders);
    const hasMultipleOrders = session.orders.filter(o => o.status !== 'rejected').length > 1;

    return (
      <div
        ref={ref}
        className={`
          bg-white
          ${isPrintMode ? 'w-[80mm] px-3 py-4 text-xs' : 'max-w-sm mx-auto px-6 py-8'}
          print:w-[80mm] print:px-3 print:py-4 print:text-[10px] print:max-w-none print:mx-0
        `}
        style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
      >
        {/* ========== HEADER ========== */}
        <div className="text-center mb-5 print:mb-3">
          <h1 
            className={`font-bold ${isPrintMode ? 'text-base' : 'text-xl'} print:text-base tracking-tight`}
            style={{ color: '#111' }}
          >
            {session.restaurant_name}
          </h1>
          
          {/* Custom Header Text */}
          {session.receipt_header_text && (
            <p 
              className={`${isPrintMode ? 'text-[10px]' : 'text-sm'} print:text-[10px] mt-1`}
              style={{ color: '#666' }}
            >
              {session.receipt_header_text}
            </p>
          )}
          
          {addressLine && (
            <p 
              className={`${isPrintMode ? 'text-[10px]' : 'text-sm'} print:text-[10px] mt-1`}
              style={{ color: '#666' }}
            >
              {addressLine}
            </p>
          )}
          
          {session.restaurant_phone && (
            <p 
              className={`${isPrintMode ? 'text-[10px]' : 'text-sm'} print:text-[10px]`}
              style={{ color: '#666' }}
            >
              {session.restaurant_phone}
            </p>
          )}
          
          {session.restaurant_vat_tin && (
            <p 
              className={`${isPrintMode ? 'text-[10px]' : 'text-xs'} print:text-[10px] mt-1`}
              style={{ color: '#666' }}
            >
              VAT TIN: {session.restaurant_vat_tin}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t my-4 print:my-2" style={{ borderColor: '#E5E7EB' }} />

        {/* ========== INVOICE INFO BLOCK ========== */}
        <div className={`space-y-1 mb-4 print:mb-2 ${isPrintMode ? 'text-[10px]' : 'text-sm'} print:text-[10px]`} style={{ color: '#666' }}>
          {session.invoice_number && (
            <div className="flex justify-between">
              <span>Invoice</span>
              <span style={{ color: '#111' }}>{session.invoice_number}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span>Table</span>
            <span style={{ color: '#111' }}>{session.table_number}</span>
          </div>
          
          <div className="flex justify-between">
            <span>Type</span>
            <span style={{ color: '#111' }}>{formatOrderType(session.order_type)}</span>
          </div>
          
          <div className="flex justify-between">
            <span>Date</span>
            <span style={{ color: '#111' }}>
              {format(new Date(session.started_at), 'MMM d, yyyy')}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>Time</span>
            <span style={{ color: '#111' }}>
              {format(new Date(session.started_at), 'h:mm a')}
              {session.ended_at && ` – ${format(new Date(session.ended_at), 'h:mm a')}`}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t my-4 print:my-2" style={{ borderColor: '#E5E7EB' }} />

        {/* ========== ITEMS SECTION ========== */}
        <div className="space-y-3 print:space-y-2">
          {hasMultipleOrders ? (
            // Group by order when multiple orders exist
            session.orders
              .filter(order => order.status !== 'rejected')
              .map((order, orderIndex) => (
                <div key={order.id} className="space-y-2 print:space-y-1">
                  <p 
                    className={`font-medium ${isPrintMode ? 'text-[10px]' : 'text-xs'} print:text-[10px] uppercase tracking-wide`}
                    style={{ color: '#666' }}
                  >
                    Order {orderIndex + 1}
                  </p>
                  {order.items.map((item) => (
                    <ItemRow 
                      key={item.id} 
                      item={item} 
                      formatPrice={formatPrice} 
                      isPrintMode={isPrintMode}
                    />
                  ))}
                </div>
              ))
          ) : (
            // Single flat list when only one order
            allItems.map((item) => (
              <ItemRow 
                key={item.id} 
                item={item} 
                formatPrice={formatPrice} 
                isPrintMode={isPrintMode}
              />
            ))
          )}
        </div>

        {/* ========== SPECIAL INSTRUCTIONS ========== */}
        {session.orders.some(order => order.customer_notes && order.customer_notes.trim()) && (
          <>
            <div className="border-t my-4 print:my-2" style={{ borderColor: '#E5E7EB' }} />
            <div className={`${isPrintMode ? 'text-[10px]' : 'text-sm'} print:text-[10px]`}>
              <p className="font-medium mb-2" style={{ color: '#666' }}>Special Instructions</p>
              <div className="space-y-2 print:space-y-1">
                {session.orders
                  .filter(order => order.customer_notes && order.customer_notes.trim())
                  .map((order, idx) => (
                    <div key={order.id}>
                      <p className="font-medium" style={{ color: '#777', fontSize: isPrintMode ? '9px' : '12px' }}>
                        Order {idx + 1}:
                      </p>
                      <p 
                        className="whitespace-pre-wrap pl-2"
                        style={{ color: '#888' }}
                      >
                        {order.customer_notes}
                      </p>
                    </div>
                  ))
                }
              </div>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="border-t my-4 print:my-2" style={{ borderColor: '#E5E7EB' }} />

        {/* ========== TOTALS SECTION ========== */}
        <div className={`space-y-2 print:space-y-1 ${isPrintMode ? 'text-xs' : 'text-sm'} print:text-[10px]`}>
          <div className="flex justify-between" style={{ color: '#111' }}>
            <span>Subtotal</span>
            <span>{formatPrice(totalBill)}</span>
          </div>
          
          {taxRate > 0 && (
            <div className="flex justify-between" style={{ color: '#666' }}>
              <span>Tax ({taxRate}%)</span>
              <span>{formatPrice(taxAmount)}</span>
            </div>
          )}
          
          {serviceChargeRate > 0 && (
            <div className="flex justify-between" style={{ color: '#666' }}>
              <span>Service ({serviceChargeRate}%)</span>
              <span>{formatPrice(serviceChargeAmount)}</span>
            </div>
          )}
          
          {/* Exchange Rate Info */}
          <div className="flex justify-between" style={{ color: '#888' }}>
            <span className={`${isPrintMode ? 'text-[9px]' : 'text-xs'} print:text-[9px]`}>
              Rate: 1 USD = {exchangeRate.toLocaleString()} KHR
            </span>
          </div>
          
          {/* Total Divider */}
          <div className="border-t pt-2 mt-2 print:pt-1 print:mt-1" style={{ borderColor: '#E5E7EB' }}>
            {/* USD Total */}
            <div 
              className={`flex justify-between font-bold ${isPrintMode ? 'text-sm' : 'text-lg'} print:text-sm`}
              style={{ color: '#111' }}
            >
              <span>Total</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
            
            {/* KHR Total */}
            <div 
              className={`flex justify-between font-bold ${isPrintMode ? 'text-sm' : 'text-lg'} print:text-sm mt-1`}
              style={{ color: '#111' }}
            >
              <span>សរុប</span>
              <span>{formatKHR(grandTotalKHR)}</span>
            </div>
          </div>
          
          {/* Amount in Words */}
          <div className={`mt-3 pt-2 border-t print:mt-2 print:pt-1 ${isPrintMode ? 'text-[9px]' : 'text-xs'} print:text-[9px]`} style={{ borderColor: '#E5E7EB', color: '#888' }}>
            <p className="mb-1">{numberToWordsEnglish(grandTotal, 'USD')}</p>
            <p>{numberToWordsKhmer(grandTotalKHR)}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t my-4 print:my-2" style={{ borderColor: '#E5E7EB' }} />

        {/* ========== PAYMENT STATUS ========== */}
        <div className="text-center py-2">
          {session.status === 'paid' ? (
            <div className="space-y-1">
              <div 
                className={`inline-flex items-center gap-1.5 font-semibold ${isPrintMode ? 'text-sm' : 'text-base'} print:text-sm`}
                style={{ color: '#16a34a' }}
              >
                <Check className="h-4 w-4 print:h-3 print:w-3" strokeWidth={3} />
                <span>PAID</span>
              </div>
              
              {session.cashier_name && (
                <p 
                  className={`${isPrintMode ? 'text-[10px]' : 'text-sm'} print:text-[10px]`}
                  style={{ color: '#666' }}
                >
                  Cashier: {session.cashier_name}
                </p>
              )}
              
              {session.ended_at && (
                <p 
                  className={`${isPrintMode ? 'text-[10px]' : 'text-xs'} print:text-[10px]`}
                  style={{ color: '#666' }}
                >
                  {format(new Date(session.ended_at), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </div>
          ) : (
            <div 
              className={`font-semibold ${isPrintMode ? 'text-sm' : 'text-base'} print:text-sm`}
              style={{ color: '#666' }}
            >
              UNPAID
            </div>
          )}
        </div>

        {/* ========== FOOTER ========== */}
        <div 
          className={`text-center mt-4 print:mt-2 ${isPrintMode ? 'text-[10px]' : 'text-sm'} print:text-[10px]`}
          style={{ color: '#666' }}
        >
          <p>{session.receipt_footer_text || 'Thank you for dining with us!'}</p>
        </div>
      </div>
    );
  }
);

// Separate component for item rows
interface ItemRowProps {
  item: OrderItem;
  formatPrice: (amount: number) => string;
  isPrintMode: boolean;
}

const ItemRow = ({ item, formatPrice, isPrintMode }: ItemRowProps) => {
  const { size, options } = parseItemNotes(item.notes);
  const itemTotal = item.price_usd * item.quantity;

  // Build item name with size
  const itemName = size 
    ? `${item.menu_item_name} (${size})`
    : item.menu_item_name;

  return (
    <div className={`${isPrintMode ? 'text-xs' : 'text-sm'} print:text-[10px]`}>
      {/* Main item line */}
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-2">
          <span className="font-medium" style={{ color: '#111' }}>
            {item.quantity > 1 && `${item.quantity}× `}{itemName}
          </span>
        </div>
        <span className="font-medium whitespace-nowrap" style={{ color: '#111' }}>
          {formatPrice(itemTotal)}
        </span>
      </div>

      {/* Options (indented) */}
      {options.length > 0 && (
        <div className="pl-3 print:pl-2 mt-0.5 space-y-0.5">
          {options.map((opt, idx) => (
            <div 
              key={idx} 
              className={`flex justify-between ${isPrintMode ? 'text-[9px]' : 'text-xs'} print:text-[9px]`}
              style={{ color: '#666' }}
            >
              <span>+ {opt.value}</span>
              {opt.price > 0 && (
                <span>{formatPrice(opt.price)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

SessionReceipt.displayName = 'SessionReceipt';

export default SessionReceipt;

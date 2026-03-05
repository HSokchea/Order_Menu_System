import { format } from 'date-fns';
import type { ReceiptSession, SessionOrder } from './SessionReceipt';

interface ReceiptItemsSectionProps {
  session: ReceiptSession;
  formatPrice: (amount: number) => string;
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

    if (parsed.size) {
      result.size = parsed.size;
    }

    if (parsed.selectedOptions && Array.isArray(parsed.selectedOptions)) {
      const sizePattern = /^(S|M|L|XL|XXL|Small|Medium|Large|Extra Large)$/i;
      result.options = parsed.selectedOptions.filter((opt: ParsedOption) => {
        if (opt.group?.toLowerCase() === 'size' || sizePattern.test(opt.value)) {
          if (!result.size) result.size = opt.value;
          return false;
        }
        return true;
      });
    }

    return result;
  } catch {
    return { options: [] };
  }
};

const ReceiptItemsSection = ({ session, formatPrice }: ReceiptItemsSectionProps) => {
  const activeOrders = session.orders.filter(o => o.status !== 'rejected');
  const hasMultipleOrders = activeOrders.length > 1;

  if (hasMultipleOrders) {
    return (
      <div className="my-4 space-y-4">
        {activeOrders.map((order, idx) => (
          <OrderBlock
            key={order.id}
            order={order}
            roundNumber={idx + 1}
            formatPrice={formatPrice}
            showHeader
          />
        ))}
      </div>
    );
  }

  // Single order — no round header
  const items = activeOrders.flatMap(o => o.items);

  return (
    <div className="my-4 space-y-2">
      {items.map(item => (
        <ItemLine key={item.id} item={item} formatPrice={formatPrice} />
      ))}

      {/* Special request for single order */}
      {activeOrders.length === 1 && activeOrders[0].customer_notes?.trim() && (
        <div className="mt-1.5 pl-2 text-xs" style={{ color: '#666' }}>
          <span className="font-medium">Note:</span>{' '}
          <span className="italic">{activeOrders[0].customer_notes}</span>
        </div>
      )}
    </div>
  );
};

// Order block with header, items, notes, and subtotal
const OrderBlock = ({
  order,
  roundNumber,
  formatPrice,
  showHeader,
}: {
  order: SessionOrder;
  roundNumber: number;
  formatPrice: (amount: number) => string;
  showHeader: boolean;
}) => {
  return (
    <div>
      {showHeader && (
        <div className="flex justify-between items-baseline mb-2">
          <span className="font-medium text-sm" style={{ color: '#333' }}>
            Round {roundNumber}
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            {format(new Date(order.created_at), 'h:mm a')}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {order.items.map(item => (
          <ItemLine key={item.id} item={item} formatPrice={formatPrice} />
        ))}
      </div>

      {/* Special request */}
      {order.customer_notes?.trim() && (
        <div className="mt-1.5 pl-2 text-xs" style={{ color: '#666' }}>
          <span className="font-medium">Note:</span>{' '}
          <span className="italic">{order.customer_notes}</span>
        </div>
      )}

      {/* Round subtotal */}
      <div
        className="flex justify-between text-sm mt-2 pt-1"
        style={{ borderTop: '1px dotted #ccc', color: '#555' }}
      >
        <span>Round {roundNumber} Subtotal</span>
        <span className="tabular-nums">{formatPrice(order.total_usd)}</span>
      </div>
    </div>
  );
};

// Single item line
const ItemLine = ({
  item,
  formatPrice,
}: {
  item: { id: string; quantity: number; price_usd: number; notes: string | null; menu_item_name: string };
  formatPrice: (amount: number) => string;
}) => {
  const { size, options } = parseItemNotes(item.notes);
  const itemTotal = item.price_usd * item.quantity;
  const itemName = size ? `${item.menu_item_name} (${size})` : item.menu_item_name;

  return (
    <div className="text-sm">
      <div className="flex justify-between" style={{ color: '#222' }}>
        <span>{item.quantity} × {itemName}</span>
        <span className="tabular-nums">{formatPrice(itemTotal)}</span>
      </div>
      {options.length > 0 && (
        <div className="pl-4 mt-0.5">
          {options.map((opt, idx) => (
            <div key={idx} className="flex justify-between text-xs" style={{ color: '#888' }}>
              <span>- {opt.group}: {opt.value}</span>
              {opt.price > 0 && <span>+{formatPrice(opt.price)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReceiptItemsSection;

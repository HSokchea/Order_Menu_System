import { format } from 'date-fns';
import type { StoredOrderItem, OrderRound } from '@/types/order';
import { groupItemsIntoRounds, groupOrderItems, calculateOrderTotal } from '@/types/order';

interface BillItemsSectionProps {
  items: StoredOrderItem[];
  formatPrice: (amount: number) => string;
}

const BillItemsSection = ({ items, formatPrice }: BillItemsSectionProps) => {
  // Filter out rejected items for display
  const activeItems = items.filter(i => i.status !== 'rejected');
  const rejectedItems = items.filter(i => i.status === 'rejected');

  // Group into rounds (returns newest first, we want oldest first for receipt)
  const rounds = groupItemsIntoRounds(items).reverse();
  const hasMultipleRounds = rounds.length > 1;

  if (hasMultipleRounds) {
    return (
      <div className="my-4 space-y-4">
        {rounds.map((round) => (
          <RoundBlock
            key={round.roundNumber}
            round={round}
            formatPrice={formatPrice}
            showHeader={true}
          />
        ))}
      </div>
    );
  }

  // Single round — no header
  const grouped = groupOrderItems(activeItems);

  return (
    <div className="my-4">
      <div className="space-y-2">
        {grouped.map((item, idx) => (
          <ItemLine key={idx} item={item} formatPrice={formatPrice} />
        ))}
      </div>

      {/* Special request for single round */}
      {rounds.length === 1 && rounds[0].specialRequest && (
        <div className="mt-2 pl-2">
          <p className="text-xs" style={{ color: '#888' }}>
            <span className='text-base'>Note:</span>
            <span>{rounds[0].specialRequest}</span>
          </p>
        </div>
      )}

      {/* Rejected items */}
      {rejectedItems.length > 0 && (
        <RejectedBlock items={rejectedItems} formatPrice={formatPrice} />
      )}
    </div>
  );
};

// Round block with header, items, special request, and subtotal
const RoundBlock = ({
  round,
  formatPrice,
  showHeader,
}: {
  round: OrderRound;
  formatPrice: (amount: number) => string;
  showHeader: boolean;
}) => {
  const activeItems = round.items.filter(i => i.status !== 'rejected');
  const rejectedInRound = round.items.filter(i => i.status === 'rejected');
  const grouped = groupOrderItems(activeItems);
  const roundSubtotal = calculateOrderTotal(round.items);

  return (
    <div>
      {showHeader && (
        <div className="flex justify-between items-baseline mb-2">
          <span className="font-medium text-sm" style={{ color: '#333' }}>
            Round {round.roundNumber}
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            {format(new Date(round.timestamp), 'h:mm a')}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {grouped.map((item, idx) => (
          <ItemLine key={idx} item={item} formatPrice={formatPrice} />
        ))}
      </div>

      {/* Special request */}
      {round.specialRequest?.trim() && (
        <div className="mt-1.5 pl-2 text-xs" style={{ color: '#666' }}>
          <span className="font-medium">Note:</span>{" "}
          <span className="italic">{round.specialRequest}</span>
        </div>
      )}

      {/* Rejected items in this round */}
      {rejectedInRound.length > 0 && (
        <div className="mt-1.5 space-y-1 opacity-50">
          {groupOrderItems(rejectedInRound).map((item, idx) => {
            const optTotal = item.options?.reduce((s, o) => s + o.price, 0) || 0;
            const lineTotal = (item.price + optTotal) * item.count;
            return (
              <div key={idx} className="flex justify-between text-xs line-through" style={{ color: '#999' }}>
                <span>{item.count} × {item.name}</span>
                <span>{formatPrice(lineTotal)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Round subtotal */}
      <div className="flex justify-between text-sm mt-2 pt-1" style={{ borderTop: '1px dotted #ccc', color: '#555' }}>
        <span>Round {round.roundNumber} Subtotal</span>
        <span>{formatPrice(roundSubtotal)}</span>
      </div>
    </div>
  );
};

// Single item line
const ItemLine = ({
  item,
  formatPrice,
}: {
  item: { name: string; price: number; count: number; options: { groupName: string; label: string; price: number }[] };
  formatPrice: (amount: number) => string;
}) => {
  const optionsTotal = item.options?.reduce((s, o) => s + o.price, 0) || 0;
  const lineTotal = (item.price + optionsTotal) * item.count;

  return (
    <div className="text-sm">
      <div className="flex justify-between" style={{ color: '#222' }}>
        <span>{item.count} × {item.name}</span>
        <span className="tabular-nums">{formatPrice(lineTotal)}</span>
      </div>
      {item.options && item.options.length > 0 && (
        <div className="pl-4 mt-0.5">
          {item.options.map((opt, idx) => (
            <div key={idx} className="flex justify-between text-xs" style={{ color: '#888' }}>
              <span>- {opt.groupName}: {opt.label}</span>
              {opt.price > 0 && <span>+{formatPrice(opt.price)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Rejected items block
const RejectedBlock = ({
  items,
  formatPrice,
}: {
  items: StoredOrderItem[];
  formatPrice: (amount: number) => string;
}) => {
  const grouped = groupOrderItems(items);
  return (
    <div className="mt-3 pt-2 opacity-50" style={{ borderTop: '1px dotted #ccc' }}>
      <p className="text-xs mb-1" style={{ color: '#999' }}>Rejected:</p>
      {grouped.map((item, idx) => {
        const optTotal = item.options?.reduce((s, o) => s + o.price, 0) || 0;
        const lineTotal = (item.price + optTotal) * item.count;
        return (
          <div key={idx} className="flex justify-between text-xs line-through" style={{ color: '#999' }}>
            <span>{item.count} × {item.name}</span>
            <span>{formatPrice(lineTotal)}</span>
          </div>
        );
      })}
    </div>
  );
};

export default BillItemsSection;

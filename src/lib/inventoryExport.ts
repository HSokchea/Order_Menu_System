import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { InventoryTransaction } from '@/hooks/useInventory';

export function exportInventoryHistory(transactions: InventoryTransaction[], exportFormat: 'csv' | 'xlsx') {
  const getRefLabel = (tx: InventoryTransaction) => {
    const ref = tx.reference_id;
    switch (tx.type) {
      case 'order': return ref ? `Order #${ref.substring(0, 8).toUpperCase()}` : '';
      case 'order_reversal': return ref ? `Reversal #${ref.substring(0, 8).toUpperCase()}` : 'Order Reversal';
      case 'purchase': return ref ? `Invoice #${ref}` : 'Stock Purchase';
      case 'waste': return tx.note || 'Waste';
      case 'adjustment': return tx.note || 'Manual Adjustment';
      default: return ref || '';
    }
  };

  const data = transactions.map(tx => ({
    'Date': format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
    'Ingredient': tx.ingredient?.name || '',
    'Type': tx.type,
    'Quantity': tx.quantity,
    'Unit': tx.ingredient?.unit || '',
    'Reference': getRefLabel(tx),
    'Note': tx.note || '',
  }));

  if (data.length === 0) return { success: false, message: 'No data to export' };

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory History');
  ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length, 14) }));

  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const fileName = `inventory-history-${dateStr}.${exportFormat}`;
  XLSX.writeFile(wb, fileName, { bookType: exportFormat === 'csv' ? 'csv' : 'xlsx' });

  return { success: true, message: `Exported ${data.length} records` };
}

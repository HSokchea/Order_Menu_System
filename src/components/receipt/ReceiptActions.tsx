import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Printer, Download, CreditCard, MoreHorizontal, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { printViaIframe, printEscPos } from '@/lib/printUtils';
import type { ReceiptSession } from './SessionReceipt';

interface ReceiptActionsProps {
  receiptRef: React.RefObject<HTMLDivElement>;
  sessionId: string;
  isPaid: boolean;
  isProcessing?: boolean;
  onCompletePayment?: () => void;
  showPayButton?: boolean;
  onClose?: () => void;
  session?: ReceiptSession;
}

export const ReceiptActions = ({
  receiptRef,
  sessionId,
  isPaid,
  isProcessing = false,
  onCompletePayment,
  showPayButton = true,
  onClose,
  session,
}: ReceiptActionsProps) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!receiptRef.current || isPrinting) return;
    setIsPrinting(true);

    try {
      const title = `Receipt - Session ${sessionId.slice(0, 8).toUpperCase()}`;
      await printViaIframe(receiptRef.current, title);
    } catch (err) {
      console.error('Print error:', err);
      toast.error('Could not print. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleThermalPrint = async () => {
    if (!session || isPrinting) return;
    setIsPrinting(true);

    try {
      const activeOrders = session.orders.filter(o => o.status !== 'rejected');
      const subtotal = activeOrders.reduce((s, o) => s + o.total_usd, 0);

      const taxRate = (session.show_tax_on_receipt && session.default_tax_percentage) ? session.default_tax_percentage / 100 : 0;
      const scRate = (session.show_service_charge_on_receipt && session.service_charge_percentage) ? session.service_charge_percentage / 100 : 0;
      const tax = subtotal * taxRate;
      const serviceCharge = subtotal * scRate;
      const total = subtotal + tax + serviceCharge;

      const rate = session.exchange_rate_at_payment ?? session.exchange_rate_usd_to_khr;
      const totalKhr = rate ? Math.round(total * rate) : undefined;

      const items = activeOrders.flatMap(o => o.items.map(item => {
        let options: Array<{ label: string; price: number }> = [];
        try {
          const parsed = item.notes ? JSON.parse(item.notes) : null;
          if (parsed?.selectedOptions) {
            options = parsed.selectedOptions.map((opt: any) => ({
              label: `${opt.group}: ${opt.value}`,
              price: opt.price || 0,
            }));
          }
        } catch { /* ignore */ }

        return {
          name: item.menu_item_name,
          quantity: item.quantity,
          price: item.price_usd,
          options: options.length > 0 ? options : undefined,
        };
      }));

      const { format } = await import('date-fns');

      await printEscPos({
        restaurantName: session.restaurant_name,
        address: [session.restaurant_address, session.restaurant_city, session.restaurant_country].filter(Boolean).join(', ') || undefined,
        phone: session.restaurant_phone || undefined,
        vatTin: session.restaurant_vat_tin || undefined,
        invoiceNumber: session.invoice_number || undefined,
        tableNumber: `Table ${session.table_number}`,
        orderType: session.order_type || undefined,
        startedAt: format(new Date(session.started_at), 'dd/MM/yyyy h:mm a'),
        endedAt: session.ended_at,
        items,
        subtotal,
        tax: tax > 0 ? tax : undefined,
        serviceCharge: serviceCharge > 0 ? serviceCharge : undefined,
        total,
        totalKhr,
        isPaid: session.status === 'paid',
        footerText: session.receipt_footer_text,
      });

      toast.success('Sent to thermal printer');
    } catch (err: any) {
      console.error('Thermal print error:', err);
      toast.error(err?.message || 'Thermal printing failed. Is QZ Tray running?');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!receiptRef.current) return;

    try {
      toast.info('Generating PDF... Please wait');

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [imgWidth, imgHeight + 10],
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 5, imgWidth, imgHeight);
      pdf.save(`receipt-${sessionId.slice(0, 8)}.pdf`);

      toast.success('Receipt saved successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Could not generate PDF');
    }
  };

  return (
    <DropdownMenu>
      <div className='flex gap-0'>
        <DropdownMenuTrigger asChild>
          <Button variant="custom" size="custom" className='mb-2 p-2 hover:bg-accent' aria-label="More actions" disabled={isPrinting}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <Button variant="custom" size="custom" className='mb-2 p-2 hover:bg-accent' aria-label="Close receipt" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePrint} disabled={isPrinting}>
          <Printer className="h-4 w-4 mr-2" />
          {isPrinting ? 'Printing...' : 'Print'}
        </DropdownMenuItem>
        {session && (
          <DropdownMenuItem onClick={handleThermalPrint} disabled={isPrinting}>
            <Zap className="h-4 w-4 mr-2" />
            Thermal Print (ESC/POS)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </DropdownMenuItem>
        {showPayButton && !isPaid && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onCompletePayment?.()}
              disabled={isProcessing}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Mark as Paid'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ReceiptActions;

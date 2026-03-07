import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Printer, Download, CreditCard, MoreHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ReceiptActionsProps {
  receiptRef: React.RefObject<HTMLDivElement>;
  sessionId: string;
  isPaid: boolean;
  isProcessing?: boolean;
  onCompletePayment?: () => void;
  showPayButton?: boolean;
  onClose?: () => void;
}

export const ReceiptActions = ({
  receiptRef,
  sessionId,
  isPaid,
  isProcessing = false,
  onCompletePayment,
  showPayButton = true,
  onClose,
}: ReceiptActionsProps) => {

  const handlePrint = () => {
    if (!receiptRef.current) return;

    // Clone the receipt content so we capture computed styles as inline
    const clone = receiptRef.current.cloneNode(true) as HTMLElement;

    // Build a standalone HTML document for printing
    const printHTML = `<!DOCTYPE html>
<html>
<head>
<title>Receipt</title>
<style>
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  width: 80mm;
  padding: 4mm;
  background: white;
  color: black;
}
.text-center { text-align: center; }
.receipt-logo {
  display: block; margin: 0 auto; border-radius: 9999px;
  object-fit: cover; border: 1px solid #e5e7eb; background: #fff;
  height: 48px; width: 48px;
}
.font-bold { font-weight: bold; }
.font-semibold { font-weight: 600; }
.font-medium { font-weight: 500; }
.flex { display: flex; }
.justify-between { justify-content: space-between; }
.items-center { align-items: center; }
.items-baseline { align-items: baseline; }
.gap-2 { gap: 8px; }
.inline-flex { display: inline-flex; }
.space-y-1 > * + * { margin-top: 4px; }
.space-y-2 > * + * { margin-top: 8px; }
.space-y-4 > * + * { margin-top: 16px; }
.mb-2 { margin-bottom: 8px; }
.mb-4 { margin-bottom: 16px; }
.mt-2 { margin-top: 8px; }
.mt-6 { margin-top: 24px; }
.my-4 { margin-top: 16px; margin-bottom: 16px; }
.pl-2 { padding-left: 8px; }
.pl-4 { padding-left: 16px; }
.pt-1 { padding-top: 4px; }
.pt-2 { padding-top: 8px; }
.mt-1 { margin-top: 4px; }
.mb-3 { margin-bottom: 12px; }
.space-y-1\\.5 > * + * { margin-top: 6px; }
.text-lg { font-size: 14px; }
.text-xl { font-size: 16px; }
.text-base { font-size: 13px; }
.text-sm { font-size: 12px; }
.text-xs { font-size: 10px; }
.tracking-wide { letter-spacing: 0.025em; }
.italic { font-style: italic; }
.tabular-nums { font-variant-numeric: tabular-nums; }
.gap-1\\.5 { gap: 6px; }
.border-t { border-top: 1px dashed #000; }
svg { display: inline-block; vertical-align: middle; }
</style>
</head>
<body>${clone.innerHTML}</body>
</html>`;

    // Use Blob + object URL to open a new tab without document.write blocking issues
    const blob = new Blob([printHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const printWindow = window.open(url, '_blank');
    if (!printWindow) {
      toast.error('Could not open print window. Please allow popups.');
      URL.revokeObjectURL(url);
      return;
    }

    // Wait for load, then print. Use onafterprint to close cleanly.
    printWindow.onload = () => {
      // Small delay to ensure rendering is complete
      setTimeout(() => {
        // Set up cleanup BEFORE calling print (which blocks)
        printWindow.onafterprint = () => {
          printWindow.close();
          URL.revokeObjectURL(url);
        };

        printWindow.print();

        // Fallback: if onafterprint doesn't fire (some browsers), 
        // clean up after user returns. We use a polling approach 
        // that doesn't block the main thread.
        const checkClosed = setInterval(() => {
          if (printWindow.closed) {
            clearInterval(checkClosed);
            URL.revokeObjectURL(url);
          }
        }, 500);

        // Ultimate fallback: stop polling after 5 minutes
        setTimeout(() => clearInterval(checkClosed), 300000);
      }, 300);
    };
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

      const imgWidth = 80; // 80mm
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
          <Button variant="custom" size="custom" className='mb-2 p-2 hover:bg-gray-100' aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <Button variant="custom" size="custom" className='mb-2 p-2 hover:bg-gray-100' aria-label="Close receipt" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> Print
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </DropdownMenuItem>
        {showPayButton && !isPaid && (
          <DropdownMenuItem
            onClick={() => onCompletePayment()}
            disabled={isProcessing}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Mark as Paid'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ReceiptActions;

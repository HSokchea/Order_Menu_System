import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileImage, FileText, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
import { QRTableCard } from './QRTableCard';
import { downloadQRCard, type PaperSize } from '@/lib/qrCardDownloader';
import { toast } from 'sonner';

interface QRCardPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: string;
  restaurantName: string;
  logoUrl?: string | null;
}

export function QRCardPreviewDialog({
  isOpen,
  onClose,
  tableId,
  tableNumber,
  restaurantName,
  logoUrl,
}: QRCardPreviewDialogProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const menuUrl = `${window.location.origin}/menu/${tableId}`;

  useEffect(() => {
    if (isOpen && tableId) {
      generateQRCode();
    }
  }, [isOpen, tableId]);

  const generateQRCode = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(menuUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownload = async (format: 'png' | 'pdf', paperSize?: PaperSize) => {
    if (!cardRef.current) return;

    setIsDownloading(true);
    try {
      const result = await downloadQRCard(cardRef.current, {
        format,
        paperSize,
        tableNumber,
        restaurantName,
      });

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to download QR card');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" hideCloseButton>
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle>QR Table Card - Table {tableNumber}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {/* Card Preview */}
          <div className="mb-6 overflow-hidden rounded-2xl">
            <QRTableCard
              ref={cardRef}
              restaurantName={restaurantName}
              tableNumber={tableNumber}
              qrCodeDataUrl={qrCodeDataUrl}
              logoUrl={logoUrl}
            />
          </div>

          {/* Download Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isDownloading || !qrCodeDataUrl} className="gap-2">
                <Download className="h-4 w-4" />
                {isDownloading ? 'Downloading...' : 'Download QR Card'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuLabel>Image Format</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleDownload('png')}>
                <FileImage className="h-4 w-4 mr-2" />
                Download as PNG
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuLabel>PDF (Print-Ready)</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleDownload('pdf', 'A6')}>
                <FileText className="h-4 w-4 mr-2" />
                A6 (Table Stand)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload('pdf', 'A5')}>
                <FileText className="h-4 w-4 mr-2" />
                A5 (Flat Table Card)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            High-resolution output ready for printing
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

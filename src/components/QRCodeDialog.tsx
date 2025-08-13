import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import QRCode from 'qrcode';

interface QRCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: string;
}

const QRCodeDialog = ({ isOpen, onClose, tableId, tableNumber }: QRCodeDialogProps) => {
  const [largeQRCode, setLargeQRCode] = useState<string>('');
  const menuUrl = `${window.location.origin}/menu/${tableId}`;

  useEffect(() => {
    if (isOpen && tableId) {
      generateLargeQRCode();
    }
  }, [isOpen, tableId]);

  const generateLargeQRCode = async () => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(menuUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setLargeQRCode(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating large QR code:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center justify-center py-8">
          {largeQRCode ? (
            <img 
              src={largeQRCode} 
              alt={`QR Code for Table ${tableNumber}`}
              className="w-96 h-96 border rounded-lg"
            />
          ) : (
            <div className="w-96 h-96 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">Generating QR Code...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeDialog;
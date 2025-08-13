import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface QRCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableNumber: string;
}

const QRCodeDialog = ({ isOpen, onClose, tableId, tableNumber }: QRCodeDialogProps) => {
  const [largeQRCode, setLargeQRCode] = useState<string>('');
  const { toast } = useToast();
  const menuUrl = `${window.location.origin}/menu/${tableId}`;

  useEffect(() => {
    if (isOpen && tableId) {
      generateLargeQRCode();
    }
  }, [isOpen, tableId]);

  const generateLargeQRCode = async () => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(menuUrl, {
        width: 350,
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

  const copyMenuUrl = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast({
        title: "URL Copied",
        description: "Menu URL has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = async () => {
    if (!largeQRCode) return;
    
    try {
      const response = await fetch(largeQRCode);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `table-${tableNumber}-qr.png`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "QR Code Downloaded",
        description: `QR code for Table ${tableNumber} has been downloaded`,
      });
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast({
        title: "Error",
        description: "Failed to download QR code. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Table {tableNumber} QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-4">
          {largeQRCode ? (
            <img 
              src={largeQRCode} 
              alt={`QR Code for Table ${tableNumber}`}
              className="w-80 h-80 border rounded-lg"
            />
          ) : (
            <div className="w-80 h-80 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">Generating QR Code...</span>
            </div>
          )}

          <div className="w-full space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Menu URL:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded break-all">
                  {menuUrl}
                </code>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={copyMenuUrl}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={downloadQRCode}
              disabled={!largeQRCode}
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeDialog;
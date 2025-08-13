import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeThumbnailProps {
  tableId: string;
  onClick: () => void;
  className?: string;
}

const QRCodeThumbnail = ({ tableId, onClick, className = '' }: QRCodeThumbnailProps) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const menuUrl = `${window.location.origin}/menu/${tableId}`;
        const dataUrl = await QRCode.toDataURL(menuUrl, {
          width: 128,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR code thumbnail:', error);
      }
    };
    
    generateQRCode();
  }, [tableId]);

  if (!qrCodeDataUrl) {
    return (
      <div className={`w-24 h-24 bg-muted rounded mx-auto flex items-center justify-center ${className}`}>
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <img 
      src={qrCodeDataUrl} 
      alt="QR Code"
      className={`w-24 h-24 rounded mx-auto cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      onClick={onClick}
    />
  );
};

export default QRCodeThumbnail;
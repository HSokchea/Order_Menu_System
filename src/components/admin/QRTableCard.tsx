import { forwardRef } from 'react';

interface QRTableCardProps {
  restaurantName: string;
  tableNumber: string;
  qrCodeDataUrl: string;
  logoUrl?: string | null;
  showFooter?: boolean;
  className?: string;
}

export const QRTableCard = forwardRef<HTMLDivElement, QRTableCardProps>(
  ({ restaurantName, tableNumber, qrCodeDataUrl, logoUrl, showFooter = true, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center w-[320px] ${className}`}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Restaurant Logo (optional) */}
        {logoUrl && (
          <img
            src={logoUrl}
            alt={restaurantName}
            className="h-12 w-auto object-contain mb-3"
            crossOrigin="anonymous"
          />
        )}

        {/* Restaurant Name */}
        <h1 className="text-xl font-bold text-gray-900 text-center mb-4 leading-tight">
          {restaurantName}
        </h1>

        {/* QR Code */}
        <div className="bg-white p-3 rounded-xl border border-gray-100 mb-4">
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt={`QR Code for Table ${tableNumber}`}
              className="w-48 h-48"
            />
          ) : (
            <div className="w-48 h-48 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-gray-400 text-sm">Generating...</span>
            </div>
          )}
        </div>

        {/* Table Number */}
        <div className="bg-gray-900 text-white px-6 py-2 rounded-lg mb-4">
          <span className="text-2xl font-bold">Table {tableNumber}</span>
        </div>

        {/* Instructions (Bilingual) */}
        <div className="text-center space-y-1">
          <p className="text-gray-600 text-sm font-medium">Scan to Order</p>
          <p className="text-gray-400 text-xs">ស្កេនដើម្បីកម្មង់</p>
        </div>

        {/* Footer */}
        {showFooter && (
          <div className="mt-4 pt-3 border-t border-gray-100 w-full text-center">
            <p className="text-gray-300 text-xs">Powered by QR Menu</p>
          </div>
        )}
      </div>
    );
  }
);

QRTableCard.displayName = 'QRTableCard';

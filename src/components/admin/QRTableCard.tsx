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
    // Fixed spacing value for consistent print output
    const spacing = 24;

    return (
      <div
        ref={ref}
        className={`bg-white border border-gray-200 rounded-2xl shadow-lg flex flex-col items-center w-[320px] ${className}`}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '32px'
        }}
      >
        {/* Top section - Restaurant branding */}
        <div className="flex flex-col items-center w-full" style={{ marginBottom: `${spacing}px` }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={restaurantName}
              className="h-12 w-auto object-contain"
              style={{ marginBottom: '8px' }}
              crossOrigin="anonymous"
            />
          )}
          <h1 className="text-xl font-bold text-gray-900 text-center leading-tight">
            {restaurantName}
          </h1>
        </div>

        {/* QR Code section - centered with consistent spacing using gap */}
        <div className="flex flex-col items-center" style={{ gap: `${spacing}px` }}>
          {/* Scan to Order text - above QR */}
          <p className="text-gray-600 text-sm font-medium">
            Scan to Order
          </p>

          {/* QR Code with corner brackets */}
          <div style={{
            position: 'relative',
            display: 'inline-block'
          }}>
            {/* Corner brackets */}
            <svg
              style={{
                position: 'absolute',
                top: '-10px',
                left: '-10px',
                width: 'calc(100% + 20px)',
                height: 'calc(100% + 20px)',
                pointerEvents: 'none',
              }}
              viewBox="0 0 212 212"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Top-left corner */}
              <path d="M 0 28 L 0 0 L 28 0" stroke="#999999" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Top-right corner */}
              <path d="M 184 0 L 212 0 L 212 28" stroke="#999999" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Bottom-left corner */}
              <path d="M 0 184 L 0 212 L 28 212" stroke="#999999" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Bottom-right corner */}
              <path d="M 212 184 L 212 212 L 184 212" stroke="#999999" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt={`QR Code for Table ${tableNumber}`}
                style={{ display: 'block', width: '192px', height: '192px' }}
              />
            ) : (
              <div className="bg-gray-100 rounded flex items-center justify-center" style={{ width: '192px', height: '192px' }}>
                <span className="text-gray-400 text-sm">Generating...</span>
              </div>
            )}
          </div>

          {/* Table number text - below QR with equal spacing via gap */}
          <p className="text-gray-600 text-sm font-medium">
            Table {tableNumber}
          </p>
        </div>

        {/* Bottom section - Footer */}
        {showFooter && (
          <div
            className="w-full text-center border-t border-gray-100"
            style={{ marginTop: `${spacing}px`, paddingTop: '12px' }}
          >
            <p className="text-gray-300 text-xs">Powered by QR Menu</p>
          </div>
        )}
      </div>
    );
  }
);

QRTableCard.displayName = 'QRTableCard';

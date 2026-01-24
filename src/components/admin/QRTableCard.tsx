import { forwardRef } from 'react';

interface QRTableCardProps {
  restaurantName: string;
  tableNumber: string;
  qrCodeDataUrl: string;
  logoUrl?: string;
  showFooter?: boolean;
  className?: string;
  isPrintMode?: boolean;
}

export const QRTableCard = forwardRef<HTMLDivElement, QRTableCardProps>(
  ({ restaurantName, tableNumber, qrCodeDataUrl, logoUrl, showFooter = true, className = '', isPrintMode = false }, ref) => {
    // Fixed spacing value for consistent rendering in screen and print
    const SECTION_SPACING = 40; // Space between major sections
    const QR_TEXT_SPACING = isPrintMode ? 6 : 20; // Conditional spacing for text around QR

    return (
      <div
        ref={ref}
        className={`bg-white border border-gray-200 rounded-2xl shadow-lg flex flex-col items-center w-[320px] ${className}`}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '32px',
          minHeight: '480px' // Ensure consistent card height
        }}
      >
        {/* Top section - Restaurant branding */}
        <div
          className="flex flex-col items-center w-full"
          style={{ marginBottom: `${SECTION_SPACING}px` }}
        >
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

        {/* QR Code section with equal spacing around it */}
        <div 
          className="flex flex-col items-center"
          style={{ marginBottom: `${SECTION_SPACING}px` }}
        >
          {/* Scan to Order text - ABOVE QR */}
          <div className="text-center" style={{ marginBottom: `20px` }}>
            <p className="text-gray-600 text-base font-medium">Scan to Order</p>
          </div>

          {/* QR Code with corner brackets */}
          <div style={{
            position: 'relative',
            padding: '10px',
            display: 'inline-block'
          }}>
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
              viewBox="0 0 224 224"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M 0 30 L 0 0 L 30 0" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 194 0 L 224 0 L 224 30" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 0 194 L 0 224 L 30 224" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 224 194 L 224 224 L 194 224" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt={tableNumber ? `QR Code for Table ${tableNumber}` : `Menu QR Code`}
                className="w-48 h-48"
                style={{ display: 'block' }}
              />
            ) : (
              <div className="w-48 h-48 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-gray-400 text-sm">Generating...</span>
              </div>
            )}
          </div>

          {/* Table number text - BELOW QR (only show if tableNumber is provided) */}
          {tableNumber && (
            <div className="text-center" style={{ marginTop: `${QR_TEXT_SPACING}px` }}>
              <p className="text-gray-600 text-base font-medium">Table {tableNumber}</p>
            </div>
          )}
        </div>

        {/* Bottom section - Footer */}
        <div className="flex flex-col items-center w-full" style={{ marginTop: 'auto' }}>
          {showFooter && (
            <div
              className="w-full text-center border-t border-gray-100"
              style={{ paddingTop: '12px' }}
            >
              <p className="text-gray-300 text-xs">Powered by QR Menu</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

QRTableCard.displayName = 'QRTableCard';

import { forwardRef, useEffect, useRef, useState } from 'react';

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
    const containerRef = useRef<HTMLDivElement>(null);
    const [spacing, setSpacing] = useState<number>(24); // Default fallback

    // Calculate equal spacing when component mounts
    useEffect(() => {
      const calculateSpacing = () => {
        if (containerRef.current) {
          const container = containerRef.current;
          const containerHeight = container.offsetHeight;

          // Get heights of top and bottom sections
          const topSection = container.querySelector('[data-section="top"]') as HTMLElement;
          const bottomSection = container.querySelector('[data-section="bottom"]') as HTMLElement;
          const qrSection = container.querySelector('[data-section="qr"]') as HTMLElement;

          if (topSection && bottomSection && qrSection) {
            const topHeight = topSection.offsetHeight;
            const bottomHeight = bottomSection.offsetHeight;
            const qrHeight = qrSection.offsetHeight;

            // Calculate remaining space and divide by 2 for equal spacing above and below QR
            const remainingSpace = containerHeight - topHeight - bottomHeight - qrHeight;
            const calculatedSpacing = Math.max(24, remainingSpace / 2); // Minimum 24px

            setSpacing(calculatedSpacing);
          }
        }
      };

      // Calculate on mount
      calculateSpacing();

      // Recalculate on window resize
      window.addEventListener('resize', calculateSpacing);

      // Recalculate after a small delay to ensure all elements are rendered
      const timeoutId = setTimeout(calculateSpacing, 100);

      return () => {
        window.removeEventListener('resize', calculateSpacing);
        clearTimeout(timeoutId);
      };
    }, [restaurantName, tableNumber, qrCodeDataUrl, logoUrl, showFooter]);

    return (
      <div
        ref={(node) => {
          // Handle both refs
          containerRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={`bg-white border border-gray-200 rounded-2xl shadow-lg flex flex-col items-center w-[320px] ${className}`}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '32px'
        }}
      >
        {/* Top section - Restaurant branding */}
        <div
          data-section="top"
          className="flex flex-col items-center w-full"
          style={{ marginBottom: `${spacing}px` }}
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

        {/* QR Code section - centered with consistent spacing */}
        <div style={{ marginBottom: `${spacing}px` }}>
          <div className="text-center mb-4">
            <p className="text-gray-600 text-sm font-medium">Scan to Order</p>
          </div>
          <div style={{
            position: 'relative',
            padding: '10px',
            display: 'inline-block'
          }}>
            {/* Corner brackets */}
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
              {/* Top-left corner */}
              <path d="M 0 30 L 0 0 L 30 0" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

              {/* Top-right corner */}
              <path d="M 194 0 L 224 0 L 224 30" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

              {/* Bottom-left corner */}
              <path d="M 0 194 L 0 224 L 30 224" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

              {/* Bottom-right corner */}
              <path d="M 224 194 L 224 224 L 194 224" stroke="#999999" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt={`QR Code for Table ${tableNumber}`}
                className="w-48 h-48"
                style={{ display: 'block' }}
              />
            ) : (
              <div className="w-48 h-48 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-gray-400 text-sm">Generating...</span>
              </div>
            )}
          </div>
          <div className="text-center mt-4">
            <p className="text-gray-600 text-sm font-medium">Table {tableNumber}</p>
          </div>
        </div>

        {/* Bottom section - Table number and instructions */}
        <div
          data-section="bottom"
          className="flex flex-col items-center w-full"
        >
          {showFooter && (
            <div
              className="w-full text-center border-t border-gray-100"
              style={{ marginTop: '16px', paddingTop: '12px' }}
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

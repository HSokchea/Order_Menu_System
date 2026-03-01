import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface StickyHeaderProps {
  backUrl: string;
  title: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Optional right-side slot (e.g. refresh button is default if onRefresh provided) */
  rightSlot?: React.ReactNode;
}

const StickyHeader = forwardRef<HTMLElement, StickyHeaderProps>(
  ({ backUrl, title, onRefresh, isRefreshing, rightSlot }, ref) => (
    <header
      ref={ref}
      className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50"
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between relative">
          {/* Left — back + title on lg */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 -ml-2 flex-shrink-0" asChild>
              <Link to={backUrl}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="hidden lg:block text-base font-semibold text-foreground truncate">
              {title}
            </h1>
          </div>

          {/* Center — title on mobile/tablet */}
          <h1 className="lg:hidden absolute left-1/2 -translate-x-1/2 text-base font-semibold text-foreground pointer-events-none whitespace-nowrap">
            {title}
          </h1>

          {/* Right */}
          <div className="flex items-center flex-shrink-0">
            {rightSlot}
            {!rightSlot && onRefresh && (
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 -mr-2" onClick={onRefresh}>
                <RefreshCw className={cn('h-4 w-4 transition-transform', isRefreshing && 'animate-spin')} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
);

StickyHeader.displayName = 'StickyHeader';

export default StickyHeader;

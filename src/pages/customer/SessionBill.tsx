import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Receipt, Package2 } from 'lucide-react';
import { useTableSession } from '@/hooks/useTableSession';
import { SessionReceipt } from '@/components/receipt/SessionReceipt';

const SessionBill = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { session, loading } = useTableSession(tableId);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading bill...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/menu/${tableId}`)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold text-primary">Session Bill</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-16">
            <Receipt className="h-24 w-24 mx-auto mb-6 text-muted-foreground/50" />
            <h2 className="text-2xl font-semibold mb-2">No Active Session</h2>
            <p className="text-muted-foreground mb-6">
              Your session will start when you place your first order.
            </p>
            <Button onClick={() => navigate(`/menu/${tableId}`)}>
              Browse Menu
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm print:hidden">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/menu/${tableId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold text-primary">Your Bill</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Receipt */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <SessionReceipt ref={receiptRef} session={session} />
        </div>

        {/* Actions */}
        {session.status === 'open' && (
          <div className="mt-6 space-y-3 print:hidden">
            <p className="text-center text-muted-foreground text-sm">
              Please ask your server to complete payment
            </p>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => navigate(`/menu/${tableId}`)}
            >
              Add More Items
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionBill;

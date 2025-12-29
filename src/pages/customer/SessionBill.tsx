import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Receipt, Clock, CheckCircle, ChefHat, Package2 } from 'lucide-react';
import { useTableSession } from '@/hooks/useTableSession';
import { format } from 'date-fns';

const SessionBill = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { session, loading, getSessionTotal } = useTableSession(tableId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> New</Badge>;
      case 'preparing':
        return <Badge className="bg-orange-500"><ChefHat className="h-3 w-3 mr-1" /> Preparing</Badge>;
      case 'ready':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Ready</Badge>;
      case 'completed':
        return <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const parseItemOptions = (notes: string | null) => {
    if (!notes) return [];
    try {
      const parsed = JSON.parse(notes);
      if (parsed.selectedOptions && Array.isArray(parsed.selectedOptions)) {
        return parsed.selectedOptions;
      }
    } catch {
      // Not JSON
    }
    return [];
  };

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

  const totalBill = getSessionTotal();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/menu/${tableId}`)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-primary">Session Bill</h1>
                <p className="text-sm text-muted-foreground">
                  Table {session.table_number} • {session.restaurant_name}
                </p>
              </div>
            </div>
            <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
              {session.status === 'open' ? 'Active' : 'Paid'}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Session Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Started</span>
              <span>{format(new Date(session.started_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Orders</span>
              <span>{session.orders.length}</span>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Orders</h2>
          {session.orders.map((order, orderIndex) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Order #{orderIndex + 1}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), 'h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.items.map((item) => {
                  const options = parseItemOptions(item.notes);
                  return (
                    <div key={item.id} className="flex justify-between">
                      <div className="flex-1">
                        <p className="font-medium">
                          {item.quantity}x {item.menu_item_name}
                        </p>
                        {options.length > 0 && (
                          <div className="space-y-0.5 mt-1">
                            {options.map((opt: any, idx: number) => (
                              <p key={idx} className="text-xs text-muted-foreground">
                                • {opt.group}: {opt.value}
                                {opt.price > 0 && ` (+$${opt.price.toFixed(2)})`}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-medium">
                        ${(item.price_usd * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Order Total</span>
                  <span>${order.total_usd.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Total Bill */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total Bill</span>
              <span className="text-primary">${totalBill.toFixed(2)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Please ask your server to complete payment
            </p>
          </CardContent>
        </Card>

        {/* Add More Items */}
        {session.status === 'open' && (
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => navigate(`/menu/${tableId}`)}
          >
            Add More Items
          </Button>
        )}
      </main>
    </div>
  );
};

export default SessionBill;

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Receipt, 
  Clock, 
  CheckCircle, 
  RefreshCw,
  Users,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface TableSession {
  id: string;
  table_id: string;
  status: string;
  started_at: string;
  total_amount: number | null;
  table: {
    table_number: string;
  };
  orders: {
    id: string;
    status: string;
    total_usd: number;
  }[];
}

export const CashierDashboard = () => {
  const { restaurant } = useUserProfile();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeSessions: 0,
    readyForPayment: 0,
    totalPending: 0,
  });

  const fetchSessions = async () => {
    if (!restaurant?.id) return;

    const { data: sessionsData, error } = await supabase
      .from('table_sessions')
      .select(`
        id,
        table_id,
        status,
        started_at,
        total_amount,
        table:tables!table_sessions_table_id_fkey (
          table_number
        ),
        orders (
          id,
          status,
          total_usd
        )
      `)
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
    } else {
      const formattedSessions = (sessionsData || []).map((s: any) => ({
        ...s,
        table: s.table || { table_number: 'Unknown' }
      }));
      setSessions(formattedSessions);
      
      // Calculate stats
      const activeSessions = formattedSessions.length;
      const readyForPayment = formattedSessions.filter((s: any) => 
        s.orders.some((o: any) => o.status === 'completed' || o.status === 'ready')
      ).length;
      const totalPending = formattedSessions.reduce((sum: number, s: any) => 
        sum + s.orders.reduce((oSum: number, o: any) => oSum + (o.total_usd || 0), 0)
      , 0);

      setStats({
        activeSessions,
        readyForPayment,
        totalPending,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();

    // Set up real-time subscription
    if (!restaurant?.id) return;

    const channel = supabase
      .channel('cashier-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        () => {
          fetchSessions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Cashier Dashboard
          </h2>
          <p className="text-muted-foreground">
            Manage table sessions and collect payments
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Tables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Ready for Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.readyForPayment}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pending Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalPending.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No active sessions</p>
            <p className="text-muted-foreground">Tables with active orders will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => {
            const totalAmount = session.orders.reduce((sum, o) => sum + (o.total_usd || 0), 0);
            const hasCompletedOrders = session.orders.some(o => 
              o.status === 'completed' || o.status === 'ready'
            );
            const allCompleted = session.orders.every(o => 
              o.status === 'completed' || o.status === 'ready'
            );

            return (
              <Card 
                key={session.id} 
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  allCompleted ? 'border-l-4 border-l-success' : 
                  hasCompletedOrders ? 'border-l-4 border-l-warning' : ''
                }`}
                onClick={() => navigate('/admin/table-sessions')}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Table {session.table.table_number}
                    </CardTitle>
                    {allCompleted && (
                      <Badge variant="default" className="bg-success">
                        Ready to Pay
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Started {format(new Date(session.started_at), 'h:mm a')}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {session.orders.length} order{session.orders.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xl font-bold">${totalAmount.toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Action */}
      <div className="flex justify-center">
        <Button 
          size="lg" 
          onClick={() => navigate('/admin/table-sessions')}
          className="gap-2"
        >
          <Receipt className="h-5 w-5" />
          View All Sessions
        </Button>
      </div>
    </div>
  );
};

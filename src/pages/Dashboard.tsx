import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  BarChart3, 
  Gift, 
  TrendingUp,
  Users,
  Clock,
  Star
} from 'lucide-react';


interface Restaurant {
  id: string;
  name: string;
  description?: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (data) {
        setRestaurant(data);
      }
      setLoading(false);
    };

    fetchRestaurant();
  }, [user]);


  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h2>
        <p className="text-muted-foreground text-lg">
          Manage your restaurant's digital presence and track performance
        </p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="secondary" className="text-xs">Today</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">$1,245</div>
            <p className="text-sm text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-secondary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-secondary" />
              </div>
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">47</div>
            <p className="text-sm text-muted-foreground">Orders</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-accent/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <Badge variant="secondary" className="text-xs">Avg</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">12min</div>
            <p className="text-sm text-muted-foreground">Prep Time</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-warning" />
              </div>
              <Badge variant="secondary" className="text-xs">Rating</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">4.8</div>
            <p className="text-sm text-muted-foreground">Customer Rating</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
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
import { AdminLayout } from '@/components/admin/AdminLayout';

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
    <AdminLayout 
      title={restaurant?.name || 'Restaurant Dashboard'}
      description="Manage your restaurant's digital presence and track performance"
    >
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

      {/* Additional Features */}
      <div>
        <h3 className="text-lg font-semibold mb-6">Coming Soon</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Dashboard Analytics */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 opacity-60">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base text-muted-foreground">Advanced Analytics</CardTitle>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  <CardDescription className="text-sm">
                    Detailed insights and performance metrics
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Stock Management */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 opacity-60">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base text-muted-foreground">Stock Management</CardTitle>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  <CardDescription className="text-sm">
                    Track inventory and manage stock levels
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Promotions */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 opacity-60">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Gift className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base text-muted-foreground">Promotions & Discounts</CardTitle>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  <CardDescription className="text-sm">
                    Create special offers and discount campaigns
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
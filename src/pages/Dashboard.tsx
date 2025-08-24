import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  QrCode, 
  ClipboardList, 
  LogOut, 
  Package, 
  BarChart3, 
  Gift, 
  ArrowRight,
  Settings,
  Menu as MenuIcon,
  Store
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Restaurant {
  id: string;
  name: string;
  description?: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Store className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{restaurant?.name || 'Restaurant Dashboard'}</h1>
                  <p className="text-sm text-muted-foreground">Admin Console</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h2>
          <p className="text-muted-foreground text-lg">
            Manage your restaurant's digital presence and track performance
          </p>
        </div>

        {/* Core Features Grid */}
        <div className="mb-12">
          <h3 className="text-lg font-semibold mb-6 flex items-center">
            <MenuIcon className="h-5 w-5 mr-2 text-primary" />
            Core Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            
            {/* Menu Management */}
            <Card className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 bg-gradient-to-br from-background to-muted/20" onClick={() => navigate('/admin/menu')}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <MenuIcon className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-lg">Menu Management</CardTitle>
                <CardDescription className="text-sm">
                  Organize categories and items with drag-and-drop functionality
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Orders */}
            <Card className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 bg-gradient-to-br from-background to-muted/20" onClick={() => navigate('/admin/order-dashboard')}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                    <ClipboardList className="h-6 w-6 text-success" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-lg">Live Orders</CardTitle>
                <CardDescription className="text-sm">
                  Monitor and manage incoming orders in real-time
                </CardDescription>
              </CardHeader>
            </Card>

            {/* QR Codes */}
            <Card className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 bg-gradient-to-br from-background to-muted/20" onClick={() => navigate('/admin/qr-codes')}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
                    <QrCode className="h-6 w-6 text-warning" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-lg">QR Codes</CardTitle>
                <CardDescription className="text-sm">
                  Generate downloadable QR codes for tables
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Analytics - Coming Soon */}
            <Card className="group border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 opacity-60">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <Badge variant="secondary" className="text-xs">Soon</Badge>
                </div>
                <CardTitle className="text-lg text-muted-foreground">Dashboard Analytics</CardTitle>
                <CardDescription className="text-sm">
                  Track sales, popular items, and performance metrics
                </CardDescription>
              </CardHeader>
            </Card>

          </div>
        </div>

        {/* Additional Features */}
        <div>
          <h3 className="text-lg font-semibold mb-6 flex items-center">
            <Plus className="h-5 w-5 mr-2 text-primary" />
            Additional Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Stock Management - Coming Soon */}
            <Card className="group border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 opacity-60">
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

            {/* Promotions - Coming Soon */}
            <Card className="group border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 opacity-60">
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

            {/* Settings */}
            <Card className="group border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 opacity-60">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-base text-muted-foreground">Restaurant Settings</CardTitle>
                      <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    </div>
                    <CardDescription className="text-sm">
                      Configure restaurant details and preferences
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
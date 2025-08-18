import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, QrCode, ClipboardList, LogOut } from 'lucide-react';
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
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{restaurant?.name || 'Restaurant Dashboard'}</h1>
            <p className="text-muted-foreground">Manage your digital menu and orders</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/menu')}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="h-5 w-5 mr-2 text-primary" />
                Manage Menu
              </CardTitle>
              <CardDescription>
                Add, edit, and organize your menu items and categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Go to Menu Management
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/order-dashboard')}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ClipboardList className="h-5 w-5 mr-2 text-primary" />
                View Orders
              </CardTitle>
              <CardDescription>
                Monitor incoming orders and update their status in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                View Live Orders
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin/qr-codes')}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="h-5 w-5 mr-2 text-primary" />
                QR Codes
              </CardTitle>
              <CardDescription>
                Generate and download QR codes for your tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Generate QR Codes
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
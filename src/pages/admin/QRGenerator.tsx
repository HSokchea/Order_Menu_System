import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';

interface Table {
  id: string;
  table_number: string;
  restaurant_id: string;
}

const QRGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [restaurantId, setRestaurantId] = useState<string>('');

  const fetchTables = async () => {
    if (!user) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!restaurant) return;

    setRestaurantId(restaurant.id);

    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('table_number');

    setTables(tablesData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTables();
  }, [user]);

  const addTable = async () => {
    if (!newTableNumber || !restaurantId) return;

    const tableNumber = parseInt(newTableNumber);
    if (isNaN(tableNumber)) {
      toast({
        title: "Invalid Table Number",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('tables')
      .insert({
        table_number: tableNumber.toString(),
        restaurant_id: restaurantId,
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Table added successfully",
      });
      setNewTableNumber('');
      fetchTables();
    }
  };

  const generateQRCode = async (tableId: string, tableNumber: string) => {
    try {
      const menuUrl = `${window.location.origin}/menu/${tableId}`;
      
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(menuUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Convert data URL to blob and download
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `table-${tableNumber}-qr.png`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "QR Code Downloaded",
        description: `QR code for Table ${tableNumber} has been downloaded`,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">QR Code Generator</h1>
            <p className="text-muted-foreground">Generate QR codes for your tables</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add New Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="table-number">Table Number</Label>
                <Input
                  id="table-number"
                  type="number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Enter table number"
                />
              </div>
              <Button onClick={addTable}>
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <Card key={table.id}>
              <CardHeader>
                <CardTitle>Table {table.table_number}</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded text-center">
                      <div className="w-24 h-24 bg-primary/20 rounded mx-auto mb-2 flex items-center justify-center">
                        <span className="text-xs font-bold">QR CODE</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Menu URL: /menu/{table.id}
                      </p>
                    </div>
                  <Button 
                    className="w-full" 
                    onClick={() => generateQRCode(table.id, table.table_number)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {tables.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No tables added yet. Add your first table above.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default QRGenerator;
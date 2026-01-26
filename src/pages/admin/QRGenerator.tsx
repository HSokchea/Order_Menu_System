import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Copy, ExternalLink, QrCode, Store, UtensilsCrossed, Plus, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { QRTableCard } from '@/components/admin/QRTableCard';
import { downloadQRCard, type PaperSize } from '@/lib/qrCardDownloader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileImage, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RestaurantData {
  id: string;
  name: string;
  logo_url: string | null;
}

interface TableData {
  id: string;
  table_number: string;
}

const QRGenerator = () => {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopQrCodeDataUrl, setShopQrCodeDataUrl] = useState<string>('');
  const [tableQrCodes, setTableQrCodes] = useState<Record<string, string>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);

  // Refs for download
  const shopPreviewRef = useRef<HTMLDivElement>(null);
  const shopPrintRef = useRef<HTMLDivElement>(null);
  const tablePreviewRef = useRef<HTMLDivElement>(null);
  const tablePrintRef = useRef<HTMLDivElement>(null);

  const shopMenuUrl = restaurant ? `${window.location.origin}/menu/${restaurant.id}` : '';
  const getTableMenuUrl = (tableId: string) => 
    restaurant ? `${window.location.origin}/menu/${restaurant.id}?table_id=${tableId}` : '';

  const fetchData = async () => {
    if (!user) return;

    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('id, name, logo_url')
      .eq('owner_id', user.id)
      .single();

    if (restaurantData) {
      setRestaurant(restaurantData);

      // Fetch tables
      const { data: tablesData } = await supabase
        .from('tables')
        .select('id, table_number')
        .eq('restaurant_id', restaurantData.id)
        .order('table_number');

      setTables(tablesData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Generate Shop QR code
  useEffect(() => {
    if (restaurant?.id) {
      generateShopQRCode();
    }
  }, [restaurant?.id]);

  // Generate Table QR codes
  useEffect(() => {
    if (restaurant?.id && tables.length > 0) {
      generateTableQRCodes();
    }
  }, [restaurant?.id, tables]);

  const generateShopQRCode = async () => {
    if (!restaurant) return;

    try {
      const url = `${window.location.origin}/menu/${restaurant.id}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      });
      setShopQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating shop QR code:', error);
    }
  };

  const generateTableQRCodes = async () => {
    if (!restaurant) return;

    const qrCodes: Record<string, string> = {};
    for (const table of tables) {
      try {
        const url = `${window.location.origin}/menu/${restaurant.id}?table_id=${table.id}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
          errorCorrectionLevel: 'H',
        });
        qrCodes[table.id] = dataUrl;
      } catch (error) {
        console.error(`Error generating QR for table ${table.table_number}:`, error);
      }
    }
    setTableQrCodes(qrCodes);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank');
  };

  const handleShopDownload = async (format: 'png' | 'pdf', paperSize?: PaperSize) => {
    if (!shopPrintRef.current || !restaurant) return;

    setIsDownloading(true);
    try {
      const result = await downloadQRCard(shopPrintRef.current, {
        format,
        paperSize,
        tableNumber: 'Shop',
        restaurantName: restaurant.name,
      });

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to download QR card');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTableDownload = async (format: 'png' | 'pdf', paperSize?: PaperSize) => {
    if (!tablePrintRef.current || !restaurant || !selectedTable) return;

    setIsDownloading(true);
    try {
      const result = await downloadQRCard(tablePrintRef.current, {
        format,
        paperSize,
        tableNumber: selectedTable.table_number,
        restaurantName: restaurant.name,
      });

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to download QR card');
    } finally {
      setIsDownloading(false);
    }
  };

  const addTable = async () => {
    if (!restaurant || !newTableNumber.trim()) return;

    setIsAddingTable(true);
    try {
      const { data, error } = await supabase
        .from('tables')
        .insert({
          restaurant_id: restaurant.id,
          table_number: newTableNumber.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setTables(prev => [...prev, data].sort((a, b) => 
        a.table_number.localeCompare(b.table_number, undefined, { numeric: true })
      ));
      setNewTableNumber('');
      toast.success(`Table ${data.table_number} added`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add table');
    } finally {
      setIsAddingTable(false);
    }
  };

  const deleteTable = async (tableId: string, tableNumber: string) => {
    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;

      setTables(prev => prev.filter(t => t.id !== tableId));
      if (selectedTable?.id === tableId) {
        setSelectedTable(null);
      }
      toast.success(`Table ${tableNumber} deleted`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete table');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No restaurant found. Please complete onboarding first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">QR Code Generator</h2>
              <p className="text-sm text-muted-foreground">
                Generate QR codes for takeaway orders or dine-in tables
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Mode Tabs */}
      <Tabs defaultValue="shop" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="shop" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Shop QR
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Table QR
          </TabsTrigger>
        </TabsList>

        {/* Shop QR Tab */}
        <TabsContent value="shop">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Shop Menu QR
              </CardTitle>
              <CardDescription>
                One static QR code for takeaway, counter orders, posters, and general access. 
                No table information - orders are marked as <Badge variant="secondary">Takeaway</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* QR Card Preview */}
              <div className="flex flex-col items-center">
                <div className="overflow-hidden rounded-2xl shadow-lg border">
                  <QRTableCard
                    ref={shopPreviewRef}
                    restaurantName={restaurant.name}
                    tableNumber=""
                    qrCodeDataUrl={shopQrCodeDataUrl}
                    logoUrl={restaurant.logo_url}
                    isPrintMode={false}
                  />
                </div>

                {/* Hidden Card for Print/Download */}
                <div className="absolute opacity-0 pointer-events-none" style={{ left: '-9999px' }}>
                  <QRTableCard
                    ref={shopPrintRef}
                    restaurantName={restaurant.name}
                    tableNumber=""
                    qrCodeDataUrl={shopQrCodeDataUrl}
                    logoUrl={restaurant.logo_url}
                    isPrintMode={true}
                  />
                </div>
              </div>

              {/* Menu URL */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Menu URL</p>
                <code className="text-xs bg-background px-2 py-1 rounded border block overflow-x-auto">
                  {shopMenuUrl}
                </code>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={() => copyUrl(shopMenuUrl)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy URL
                </Button>

                <Button variant="outline" onClick={() => openUrl(shopMenuUrl)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button disabled={isDownloading || !shopQrCodeDataUrl}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Download Format</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleShopDownload('png')}>
                      <FileImage className="h-4 w-4 mr-2" />
                      PNG Image
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>PDF (Print-Ready)</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleShopDownload('pdf', 'A6')}>
                      <FileText className="h-4 w-4 mr-2" />
                      A6 (Table Stand)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShopDownload('pdf', 'A5')}>
                      <FileText className="h-4 w-4 mr-2" />
                      A5 (Flat Card)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Table QR Tab */}
        <TabsContent value="table">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tables List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5" />
                  Dine-in Tables
                </CardTitle>
                <CardDescription>
                  Create unique QR codes for each table. Orders are automatically marked as 
                  <Badge variant="secondary" className="ml-1">Dine-in</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Table */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="table-number" className="sr-only">Table Number</Label>
                    <Input
                      id="table-number"
                      placeholder="Enter table number (e.g., 1, A1, VIP)"
                      value={newTableNumber}
                      onChange={(e) => setNewTableNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTable()}
                    />
                  </div>
                  <Button onClick={addTable} disabled={isAddingTable || !newTableNumber.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>

                {/* Tables List */}
                <ScrollArea className="h-[300px] pr-4">
                  {tables.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No tables yet. Add your first table above.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tables.map((table) => (
                        <div
                          key={table.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedTable?.id === table.id
                              ? 'bg-primary/10 border-primary'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedTable(table)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center font-semibold">
                              {table.table_number}
                            </div>
                            <span className="font-medium">Table {table.table_number}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTable(table.id, table.table_number);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Selected Table QR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  {selectedTable ? `Table ${selectedTable.table_number} QR` : 'Select a Table'}
                </CardTitle>
                <CardDescription>
                  {selectedTable
                    ? 'Print this QR and place it on the table'
                    : 'Click on a table to generate its QR code'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedTable ? (
                  <>
                    {/* QR Card Preview */}
                    <div className="flex flex-col items-center">
                      <div className="overflow-hidden rounded-2xl shadow-lg border">
                        <QRTableCard
                          ref={tablePreviewRef}
                          restaurantName={restaurant.name}
                          tableNumber={selectedTable.table_number}
                          qrCodeDataUrl={tableQrCodes[selectedTable.id] || ''}
                          logoUrl={restaurant.logo_url}
                          isPrintMode={false}
                        />
                      </div>

                      {/* Hidden Card for Print/Download */}
                      <div className="absolute opacity-0 pointer-events-none" style={{ left: '-9999px' }}>
                        <QRTableCard
                          ref={tablePrintRef}
                          restaurantName={restaurant.name}
                          tableNumber={selectedTable.table_number}
                          qrCodeDataUrl={tableQrCodes[selectedTable.id] || ''}
                          logoUrl={restaurant.logo_url}
                          isPrintMode={true}
                        />
                      </div>
                    </div>

                    {/* Menu URL */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Table Menu URL</p>
                      <code className="text-xs bg-background px-2 py-1 rounded border block overflow-x-auto">
                        {getTableMenuUrl(selectedTable.id)}
                      </code>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button variant="outline" onClick={() => copyUrl(getTableMenuUrl(selectedTable.id))}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy URL
                      </Button>

                      <Button variant="outline" onClick={() => openUrl(getTableMenuUrl(selectedTable.id))}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Preview
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button disabled={isDownloading || !tableQrCodes[selectedTable.id]}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Download Format</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleTableDownload('png')}>
                            <FileImage className="h-4 w-4 mr-2" />
                            PNG Image
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>PDF (Print-Ready)</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleTableDownload('pdf', 'A6')}>
                            <FileText className="h-4 w-4 mr-2" />
                            A6 (Table Stand)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTableDownload('pdf', 'A5')}>
                            <FileText className="h-4 w-4 mr-2" />
                            A5 (Flat Card)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <QrCode className="h-16 w-16 mb-4 opacity-30" />
                    <p>Select a table to view its QR code</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QRGenerator;
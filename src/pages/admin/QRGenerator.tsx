import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Plus, Copy, Edit, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import QRCodeThumbnail from '@/components/QRCodeThumbnail';
import QRCodeDialog from '@/components/QRCodeDialog';


interface Table {
  id: string;
  table_number: string;
  restaurant_id: string;
}

const QRGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [qrCodeCache, setQrCodeCache] = useState<Record<string, string>>({});
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTableNumber, setEditTableNumber] = useState('');
  const [deletingTable, setDeletingTable] = useState<Table | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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

  // Real-time subscription for tables
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('tables-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => {
          fetchTables();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const generateQRCodeForDisplay = async (tableId: string) => {
    if (qrCodeCache[tableId]) return qrCodeCache[tableId];

    try {
      const menuUrl = `${window.location.origin}/menu/${tableId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(menuUrl, {
        width: 128,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeCache(prev => ({ ...prev, [tableId]: qrCodeDataUrl }));
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating QR code for display:', error);
      return '';
    }
  };

  const openQRDialog = (table: Table) => {
    setSelectedTable(table);
    setIsDialogOpen(true);
  };

  const copyMenuUrl = async (tableId: string) => {
    const menuUrl = `${window.location.origin}/menu/${tableId}`;
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast({
        title: "URL Copied",
        description: "Menu URL has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL. Please copy manually.",
        variant: "destructive",
      });
    }
  };

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

    // Check if table number already exists
    const existingTable = tables.find(table => table.table_number === tableNumber.toString());
    if (existingTable) {
      toast({
        title: "Duplicate Table Number",
        description: `Table ${tableNumber} already exists. Please choose a different number.`,
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

  const openEditDialog = (table: Table) => {
    setEditingTable(table);
    setEditTableNumber(table.table_number);
    setIsEditDialogOpen(true);
  };

  const updateTable = async () => {
    if (!editingTable || !editTableNumber) return;

    const tableNumber = parseInt(editTableNumber);
    if (isNaN(tableNumber)) {
      toast({
        title: "Invalid Table Number",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    // Check if table number already exists (excluding current table)
    const existingTable = tables.find(table => 
      table.table_number === tableNumber.toString() && table.id !== editingTable.id
    );
    if (existingTable) {
      toast({
        title: "Duplicate Table Number",
        description: `Table ${tableNumber} already exists. Please choose a different number.`,
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('tables')
      .update({
        table_number: tableNumber.toString(),
      })
      .eq('id', editingTable.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Table updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingTable(null);
      setEditTableNumber('');
      fetchTables();
    }
  };

  const openDeleteDialog = (table: Table) => {
    setDeletingTable(table);
    setIsDeleteDialogOpen(true);
  };

  const deleteTable = async () => {
    if (!deletingTable) return;

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', deletingTable.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Table ${deletingTable.table_number} deleted successfully`,
      });
      setIsDeleteDialogOpen(false);
      setDeletingTable(null);
      fetchTables();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Sticky Header with controls */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">QR Code Generator</h2>
              <p className="text-sm text-muted-foreground">
                Showing {tables.length} {tables.length === 1 ? 'table' : 'tables'}
              </p>
            </div>

            {/* Add Table Form */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex-1 lg:w-[200px]">
                <Label htmlFor="table-number" className="sr-only">Table Number</Label>
                <Input
                  id="table-number"
                  type="number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Table number"
                />
              </div>
              <Button onClick={addTable} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Table */}
      {tables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No tables added yet. Add your first table above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">QR Code</TableHead>
                <TableHead>Table</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <QRCodeThumbnail
                        tableId={table.id}
                        onClick={() => openQRDialog(table)}
                        className="w-8 h-8"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">Table {table.table_number}</div>
                    <div className="text-sm text-muted-foreground">
                      Click QR code to view full size
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyMenuUrl(table.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy table QR code</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateQRCode(table.id, table.table_number)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download table QR code</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(table)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit table</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(table)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete table</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedTable && (
        <QRCodeDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedTable(null);
          }}
          tableId={selectedTable.id}
          tableNumber={selectedTable.table_number}
        />
      )}

      {/* Edit Table Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-table-number">Table Number</Label>
              <Input
                id="edit-table-number"
                type="number"
                value={editTableNumber}
                onChange={(e) => setEditTableNumber(e.target.value)}
                placeholder="Enter table number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingTable(null);
                setEditTableNumber('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={updateTable}>
              Update Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete Table {deletingTable?.table_number}? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingTable(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteTable}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default QRGenerator;
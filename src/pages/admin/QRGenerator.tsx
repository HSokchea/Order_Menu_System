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
import { Download, Plus, Copy, Edit, Trash2, Eye } from 'lucide-react';
import QRCodeThumbnail from '@/components/QRCodeThumbnail';
import { QRCardPreviewDialog } from '@/components/admin/QRCardPreviewDialog';
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface TableData {
  id: string;
  table_number: string;
  restaurant_id: string;
}

interface RestaurantData {
  id: string;
  name: string;
  logo_url: string | null;
}

const QRGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTableNumber, setEditTableNumber] = useState('');
  const [deletingTable, setDeletingTable] = useState<TableData | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('id, name, logo_url')
      .eq('owner_id', user.id)
      .single();

    if (!restaurantData) return;

    setRestaurant(restaurantData);

    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantData.id)
      .order('table_number');

    setTables(tablesData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Real-time subscription for tables
  useEffect(() => {
    if (!restaurant?.id) return;

    const channel = supabase
      .channel('tables-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  const openPreviewDialog = (table: TableData) => {
    setSelectedTable(table);
    setIsPreviewOpen(true);
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
    if (!newTableNumber || !restaurant) return;

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

    const { data, error } = await supabase
      .from('tables')
      .insert({
        table_number: tableNumber.toString(),
        restaurant_id: restaurant.id,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Update qr_code_url with the menu URL
    const menuUrl = `${window.location.origin}/menu/${data.id}`;
    await supabase
      .from('tables')
      .update({ qr_code_url: menuUrl })
      .eq('id', data.id);

    toast({
      title: "Success",
      description: "Table added successfully",
    });
    setNewTableNumber('');
  };

  const openEditDialog = (table: TableData) => {
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
      fetchData();
    }
  };

  const openDeleteDialog = (table: TableData) => {
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
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Sticky Header with controls */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">QR Code Generator</h2>
              <p className="text-sm text-muted-foreground">
                Showing {tables.length} {tables.length === 1 ? 'table' : 'tables'}
              </p>
            </div>

            {/* Add Table Button */}
            <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Table
            </Button>
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
                        onClick={() => openPreviewDialog(table)}
                        className="w-8 h-8"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">Table {table.table_number}</div>
                    <div className="text-sm text-muted-foreground">
                      Click QR code to preview & download card
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPreviewDialog(table)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download QR Card</p>
                        </TooltipContent>
                      </Tooltip>
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
                          <p>Copy menu URL</p>
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

      {/* QR Card Preview Dialog */}
      {selectedTable && restaurant && (
        <QRCardPreviewDialog
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setSelectedTable(null);
          }}
          tableId={selectedTable.id}
          tableNumber={selectedTable.table_number}
          restaurantName={restaurant.name}
          logoUrl={restaurant.logo_url}
        />
      )}

      {/* Add Table Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-table-number">Table Number</Label>
              <Input
                id="new-table-number"
                type="number"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="Enter table number"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setNewTableNumber('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={async () => {
              await addTable();
              setIsAddDialogOpen(false);
            }}>
              Add Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <ConfirmDialog
        open={!!deletingTable && isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setDeletingTable(null);
        }}
        title={`Delete Table${deletingTable ? ` ${deletingTable.table_number}` : ''}?`}
        description="Are you sure you want to delete this table? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={deleteTable}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setDeletingTable(null);
        }}
      />
    </div>
    </TooltipProvider>
  );
};

export default QRGenerator;

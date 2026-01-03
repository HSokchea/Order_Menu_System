import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, CheckCircle, CreditCard, Eye, Users, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { SessionReceipt, ReceiptSession } from '@/components/receipt/SessionReceipt';
import { ReceiptActions } from '@/components/receipt/ReceiptActions';

interface SessionOrder {
  id: string;
  total_usd: number;
  status: string;
  created_at: string;
  customer_notes: string | null;
  items: Array<{
    id: string;
    quantity: number;
    price_usd: number;
    notes: string | null;
    menu_item_name: string;
  }>;
}

interface TableSession {
  id: string;
  table_id: string;
  table_number: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_phone: string | null;
  restaurant_address: string | null;
  restaurant_city: string | null;
  restaurant_country: string | null;
  restaurant_logo_url: string | null;
  restaurant_vat_tin: string | null;
  default_tax_percentage: number;
  service_charge_percentage: number;
  currency: string;
  receipt_header_text: string | null;
  receipt_footer_text: string | null;
  status: 'open' | 'paid';
  started_at: string;
  ended_at: string | null;
  total_amount: number;
  order_type: string;
  invoice_number: string | null;
  cashier_name: string | null;
  orders: SessionOrder[];
}

const TableSessions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<TableSession | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cashierName, setCashierName] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'table_number' | 'started_at' | 'total' | 'status' | null>('started_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

  const fetchSessions = async () => {
    if (!user) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, phone, address, city, country, logo_url, vat_tin, default_tax_percentage, service_charge_percentage, currency, receipt_header_text, receipt_footer_text')
      .eq('owner_id', user.id)
      .single();

    if (!restaurant) return;

    // Cast to any for new columns
    const rest = restaurant as any;

    let query = supabase
      .from('table_sessions')
      .select(`
        id,
        table_id,
        status,
        started_at,
        ended_at,
        total_amount,
        order_type,
        invoice_number,
        cashier_name,
        tables!inner(table_number)
      `)
      .eq('restaurant_id', rest.id)
      .order('started_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: sessionsData, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }

    // Fetch orders with items for each session
    const sessionsWithOrders = await Promise.all(
      (sessionsData || []).map(async (session: any) => {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, total_usd, status, created_at, customer_notes')
          .eq('table_session_id', session.id)
          .order('created_at', { ascending: true });

        // Fetch items for each order
        const ordersWithItems = await Promise.all(
          (orders || []).map(async (order) => {
            const { data: items } = await supabase
              .rpc('get_order_items_by_token', { 
                p_order_id: order.id, 
                p_order_token: '' // Admin doesn't need token
              });

            // Fallback: direct query for admin
            let orderItems = items || [];
            if (orderItems.length === 0) {
              const { data: directItems } = await supabase
                .from('order_items')
                .select('id, quantity, price_usd, notes, menu_item_id')
                .eq('order_id', order.id);

              if (directItems && directItems.length > 0) {
                const menuItemIds = directItems.map(i => i.menu_item_id);
                const { data: menuItems } = await supabase
                  .from('menu_items')
                  .select('id, name')
                  .in('id', menuItemIds);

                const menuItemMap = new Map(menuItems?.map(m => [m.id, m.name]) || []);
                orderItems = directItems.map(i => ({
                  id: i.id,
                  quantity: i.quantity,
                  price_usd: Number(i.price_usd),
                  notes: i.notes,
                  menu_item_name: menuItemMap.get(i.menu_item_id) || 'Unknown Item',
                }));
              }
            }

            return {
              ...order,
              items: orderItems,
            };
          })
        );

        return {
          id: session.id,
          table_id: session.table_id,
          table_number: session.tables.table_number,
          restaurant_id: rest.id,
          restaurant_name: rest.name,
          restaurant_phone: rest.phone || null,
          restaurant_address: rest.address || null,
          restaurant_city: rest.city || null,
          restaurant_country: rest.country || null,
          restaurant_logo_url: rest.logo_url || null,
          restaurant_vat_tin: rest.vat_tin || null,
          default_tax_percentage: Number(rest.default_tax_percentage) || 0,
          service_charge_percentage: Number(rest.service_charge_percentage) || 0,
          currency: rest.currency || 'USD',
          receipt_header_text: rest.receipt_header_text || null,
          receipt_footer_text: rest.receipt_footer_text || null,
          status: session.status,
          started_at: session.started_at,
          ended_at: session.ended_at,
          total_amount: Number(session.total_amount) || 0,
          order_type: session.order_type || 'dine_in',
          invoice_number: session.invoice_number || null,
          cashier_name: session.cashier_name || null,
          orders: ordersWithItems,
        };
      })
    );

    setSessions(sessionsWithOrders);
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();

    if (!user) return;

    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => fetchSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchSessions())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, statusFilter]);

  const handleCompletePayment = async (sessionId: string) => {
    if (!cashierName.trim()) {
      toast({
        title: 'Cashier Required',
        description: 'Please enter the cashier name before completing payment.',
        variant: 'destructive',
      });
      return;
    }

    setProcessingPayment(true);
    
    try {
      const { data, error } = await supabase.rpc('complete_session_payment', {
        p_session_id: sessionId,
        p_cashier_name: cashierName.trim(),
      } as any);

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete payment');
      }

      toast({
        title: 'Payment Completed',
        description: `Invoice ${result.invoice_number} generated. Total: $${result.total_amount.toFixed(2)}`,
      });

      setIsModalOpen(false);
      setIsPaymentModalOpen(false);
      setCashierName('');
      fetchSessions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const openPaymentModal = (session: TableSession) => {
    setSelectedSession(session);
    setCashierName('');
    setIsPaymentModalOpen(true);
  };

  const getSessionTotal = (session: TableSession) => {
    return session.orders.reduce((sum, order) => {
      if (order.status !== 'rejected') {
        return sum + Number(order.total_usd);
      }
      return sum;
    }, 0);
  };

  const openSessionsCount = sessions.filter(s => s.status === 'open').length;

  // Filter, search, sort and paginate sessions
  const filteredAndPaginatedSessions = useMemo(() => {
    let filtered = sessions;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    // Apply search filter (search by table number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(session =>
        session.table_number.toLowerCase().includes(query) ||
        session.id.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'table_number':
            aValue = parseInt(a.table_number) || 0;
            bValue = parseInt(b.table_number) || 0;
            break;
          case 'started_at':
            aValue = new Date(a.started_at).getTime();
            bValue = new Date(b.started_at).getTime();
            break;
          case 'total':
            aValue = getSessionTotal(a);
            bValue = getSessionTotal(b);
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Calculate pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      totalItems,
      totalPages,
      startIndex: startIndex + 1,
      endIndex,
      currentPage,
    };
  }, [sessions, statusFilter, searchQuery, sortField, sortDirection, currentPage, itemsPerPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Table Sessions</h2>
          <p className="text-sm text-muted-foreground">
            Showing {filteredAndPaginatedSessions.totalItems > 0 ? filteredAndPaginatedSessions.startIndex : 0}–{filteredAndPaginatedSessions.endIndex} of {filteredAndPaginatedSessions.totalItems} sessions ({openSessionsCount} active)
          </p>
        </div>
        
        {/* Controls: Search and Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sessions Table */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-center">No sessions found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer">
                  Table
                </TableHead>
                <TableHead className="cursor-pointer">
                  Started
                </TableHead>
                <TableHead>Orders</TableHead>
                <TableHead className="cursor-pointer">
                  Total 
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndPaginatedSessions.items.map((session) => {
                const total = getSessionTotal(session);
                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">Table {session.table_number}</TableCell>
                    <TableCell>{format(new Date(session.started_at), 'MMM d, h:mm a')}</TableCell>
                    <TableCell>{session.orders.length}</TableCell>
                    <TableCell className="font-semibold">${total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                        {session.status === 'open' ? (
                          <><Clock className="h-3 w-3 mr-1" /> Open</>
                        ) : (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Paid</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSession(session);
                            setIsModalOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {session.status === 'open' && (
                          <Button
                            size="sm"
                            onClick={() => openPaymentModal(session)}
                            disabled={processingPayment}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {filteredAndPaginatedSessions.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
          <div className="text-sm text-muted-foreground">
            Page {filteredAndPaginatedSessions.currentPage} of {filteredAndPaginatedSessions.totalPages}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                  }}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: filteredAndPaginatedSessions.totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current
                  return page === 1 || 
                         page === filteredAndPaginatedSessions.totalPages || 
                         Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  // Add ellipsis if there's a gap
                  const shouldShowEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <div key={page} className="flex items-center">
                      {shouldShowEllipsis && (
                        <PaginationItem>
                          <span className="px-3 py-2 text-muted-foreground">...</span>
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  );
                })}
              <PaginationItem>
                <PaginationNext 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < filteredAndPaginatedSessions.totalPages) {
                      setCurrentPage(currentPage + 1);
                    }
                  }}
                  className={currentPage >= filteredAndPaginatedSessions.totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Receipt Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt - Table {selectedSession?.table_number}</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              {/* Actions */}
              <ReceiptActions
                receiptRef={receiptRef}
                sessionId={selectedSession.id}
                isPaid={selectedSession.status === 'paid'}
                isProcessing={processingPayment}
                onCompletePayment={() => openPaymentModal(selectedSession)}
              />

              {/* Receipt Preview */}
              <div className="border rounded-lg overflow-hidden">
                <SessionReceipt
                  ref={receiptRef}
                  session={{
                    session_id: selectedSession.id,
                    table_id: selectedSession.table_id,
                    table_number: selectedSession.table_number,
                    restaurant_id: selectedSession.restaurant_id,
                    restaurant_name: selectedSession.restaurant_name,
                    restaurant_phone: selectedSession.restaurant_phone,
                    restaurant_address: selectedSession.restaurant_address,
                    restaurant_city: selectedSession.restaurant_city,
                    restaurant_country: selectedSession.restaurant_country,
                    restaurant_logo_url: selectedSession.restaurant_logo_url,
                    restaurant_vat_tin: selectedSession.restaurant_vat_tin,
                    default_tax_percentage: selectedSession.default_tax_percentage,
                    service_charge_percentage: selectedSession.service_charge_percentage,
                    currency: selectedSession.currency,
                    status: selectedSession.status,
                    started_at: selectedSession.started_at,
                    ended_at: selectedSession.ended_at,
                    total_amount: selectedSession.total_amount,
                    order_type: selectedSession.order_type,
                    invoice_number: selectedSession.invoice_number,
                    cashier_name: selectedSession.cashier_name,
                    orders: selectedSession.orders,
                  }}
                  isPrintMode
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal with Cashier Input */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
            <DialogDescription>
              Enter cashier name to complete payment for Table {selectedSession?.table_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cashier">Cashier Name *</Label>
              <Input
                id="cashier"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Enter cashier name"
                autoFocus
              />
            </div>
            {selectedSession && (
              <div className="text-sm text-muted-foreground">
                <p>Total: <span className="font-semibold text-foreground">${getSessionTotal(selectedSession).toFixed(2)}</span></p>
                <p>Orders: {selectedSession.orders.length}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedSession && handleCompletePayment(selectedSession.id)}
              disabled={processingPayment || !cashierName.trim()}
            >
              {processingPayment ? 'Processing...' : 'Complete Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TableSessions;

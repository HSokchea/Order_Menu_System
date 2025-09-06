import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, ChefHat, CheckCircle, Truck, Filter, Search, ChevronUp, ChevronDown, Eye } from 'lucide-react';


interface OrderItem {
  id: string;
  quantity: number;
  price_usd: number;
  menu_item: {
    name: string;
  };
}

interface Order {
  id: string;
  table_number: string;
  status: string;
  total_usd: number;
  customer_notes?: string;
  created_at: string;
  order_items: OrderItem[];
}

const OrderDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and search state
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'table_number' | 'total_usd' | 'status'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!restaurant) return;

    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          price_usd,
          menu_item:menu_items (name)
        )
      `)
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false });

    setOrders(ordersData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Set up real-time subscription for orders
    if (!user) return;

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Order status updated",
      });
      fetchOrders();
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'new':
        return {
          color: 'bg-warning text-warning-foreground',
          label: 'New Order',
          icon: <Clock className="h-4 w-4" />,
          next: 'preparing'
        };
      case 'preparing':
        return {
          color: 'bg-primary text-primary-foreground',
          label: 'Preparing',
          icon: <ChefHat className="h-4 w-4" />,
          next: 'ready'
        };
      case 'ready':
        return {
          color: 'bg-success text-success-foreground',
          label: 'Ready',
          icon: <Truck className="h-4 w-4" />,
          next: 'completed'
        };
      case 'completed':
        return {
          color: 'bg-muted text-muted-foreground',
          label: 'Completed',
          icon: <CheckCircle className="h-4 w-4" />,
          next: null
        };
      default:
        return {
          color: 'bg-secondary text-secondary-foreground',
          label: 'Unknown',
          icon: <Clock className="h-4 w-4" />,
          next: null
        };
    }
  };

  const getNextStepLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case 'new':
        return 'Start Preparing';
      case 'preparing':
        return 'Mark Ready';
      case 'ready':
        return 'Mark Completed';
      default:
        return null;
    }
  };

  const isOrderActive = (status: string) => {
    return ['new', 'preparing', 'ready'].includes(status);
  };

  // Filter, search, sort and paginate orders
  const filteredAndPaginatedOrders = useMemo(() => {
    let filtered = orders;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(query) ||
        order.table_number.toLowerCase().includes(query) ||
        order.id.slice(-6).toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'table_number':
          aValue = parseInt(a.table_number) || 0;
          bValue = parseInt(b.table_number) || 0;
          break;
        case 'total_usd':
          aValue = a.total_usd;
          bValue = b.total_usd;
          break;
        case 'status':
          const statusOrder = { 'new': 1, 'preparing': 2, 'ready': 3, 'completed': 4 };
          aValue = statusOrder[a.status as keyof typeof statusOrder] || 5;
          bValue = statusOrder[b.status as keyof typeof statusOrder] || 5;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

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
  }, [orders, selectedStatus, searchQuery, sortField, sortDirection, currentPage, itemsPerPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, searchQuery]);

  // Handle sorting
  const handleSort = (field: 'created_at' | 'table_number' | 'total_usd' | 'status') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'created_at' | 'table_number' | 'total_usd' | 'status') => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="h-4 w-4 ml-1" /> :
      <ChevronDown className="h-4 w-4 ml-1" />;
  };

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const getItemsSummary = (orderItems: OrderItem[]) => {
    if (orderItems.length <= 2) {
      return orderItems.map(item => `${item.quantity}x ${item.menu_item.name}`).join(', ');
    }
    return `${orderItems[0].quantity}x ${orderItems[0].menu_item.name}, ${orderItems[1].quantity}x ${orderItems[1].menu_item.name} +${orderItems.length - 2} more`;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header with filters and controls */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Order Dashboard</h2>
              <p className="text-sm text-muted-foreground">
                Showing {filteredAndPaginatedOrders.totalItems > 0 ? filteredAndPaginatedOrders.startIndex : 0}–{filteredAndPaginatedOrders.endIndex} of {filteredAndPaginatedOrders.totalItems} orders
              </p>
            </div>

            {/* Controls: Search, Filters and Sort */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filters:</span>
              </div>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                const [field, direction] = value.split('-') as [typeof sortField, typeof sortDirection];
                setSortField(field);
                setSortDirection(direction);
              }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at-desc">Newest First</SelectItem>
                  <SelectItem value="created_at-asc">Oldest First</SelectItem>
                  <SelectItem value="table_number-asc">Table No. (A-Z)</SelectItem>
                  <SelectItem value="table_number-desc">Table No. (Z-A)</SelectItem>
                  <SelectItem value="total_usd-desc">Highest Total</SelectItem>
                  <SelectItem value="total_usd-asc">Lowest Total</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-full sm:w-[260px]">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => document.getElementById('search-input')?.focus()}
                />
                <Input
                  id="search-input"
                  placeholder="Search by Order ID or Table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {filteredAndPaginatedOrders.totalItems === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-center">
              {orders.length === 0
                ? "No orders yet. New orders will appear here."
                : "No orders match your current filters. Try adjusting the filters above."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Table No.</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndPaginatedOrders.items.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const nextStepLabel = getNextStepLabel(order.status);

                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openOrderModal(order)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">#{order.id.slice(-6).toUpperCase()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate">
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">Table {order.table_number}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[200px] truncate">
                        {getItemsSummary(order.order_items)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[150px] truncate">
                        {order.customer_notes || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">${order.total_usd.toFixed(2)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig.color} gap-1`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {nextStepLabel && statusConfig.next && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, statusConfig.next!);
                            }}
                          >
                            {nextStepLabel}
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
      {filteredAndPaginatedOrders.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {Array.from({ length: filteredAndPaginatedOrders.totalPages }, (_, i) => i + 1)
                .filter(page => {
                  const start = Math.max(1, currentPage - 2);
                  const end = Math.min(filteredAndPaginatedOrders.totalPages, currentPage + 2);
                  return page >= start && page <= end;
                })
                .map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(Math.min(filteredAndPaginatedOrders.totalPages, currentPage + 1))}
                  className={currentPage >= filteredAndPaginatedOrders.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Order Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-1 text-muted-foreground">Order ID</h4>
                  <p className="font-mono">#{selectedOrder.id.slice(-6).toUpperCase()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1 text-muted-foreground">Table Number</h4>
                  <p className="font-semibold">Table {selectedOrder.table_number}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1 text-muted-foreground">Order Time</h4>
                  <p>{new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1 text-muted-foreground">Status</h4>
                  <Badge className={`${getStatusConfig(selectedOrder.status).color} gap-1`}>
                    {getStatusConfig(selectedOrder.status).icon}
                    {getStatusConfig(selectedOrder.status).label}
                  </Badge>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium text-sm mb-3 text-muted-foreground">Order Items</h4>
                <div className="space-y-3">
                  {selectedOrder.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-full text-sm font-medium">
                          {item.quantity}
                        </span>
                        <span className="font-medium">{item.menu_item.name}</span>
                      </div>
                      <span className="font-semibold">${(item.quantity * item.price_usd).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Notes */}
              {selectedOrder.customer_notes && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-muted-foreground">Customer Notes</h4>
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <p className="text-sm">{selectedOrder.customer_notes}</p>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount</span>
                  <span className="text-2xl font-bold">${selectedOrder.total_usd.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              {getNextStepLabel(selectedOrder.status) && getStatusConfig(selectedOrder.status).next && (
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, getStatusConfig(selectedOrder.status).next!);
                      setIsModalOpen(false);
                    }}
                  >
                    {getNextStepLabel(selectedOrder.status)}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDashboard;
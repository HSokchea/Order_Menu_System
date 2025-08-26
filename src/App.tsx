import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Categories from "./pages/admin/Categories";
import MenuItems from "./pages/admin/MenuItems";
import OrderDashboard from "./pages/admin/OrderDashboard";
import QRGenerator from "./pages/admin/QRGenerator";
import MenuView from "./pages/customer/MenuView";
import CartSummary from "./pages/customer/CartSummary";
import OrderSuccess from "./pages/customer/OrderSuccess";
import MyOrders from "./pages/customer/MyOrders";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <Routes>
      {/* Public customer routes */}
      <Route path="/menu/:tableId" element={<MenuView />} />
      <Route path="/cart/:tableId" element={<CartSummary />} />
      <Route path="/my-orders/:tableId" element={<MyOrders />} />
      <Route path="/order-success/:orderId" element={<OrderSuccess />} />
      
      {/* Auth routes */}
      {!user ? (
        <>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
        </>
      ) : (
        <>
          {/* Protected admin routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/categories" element={<Categories />} />
          <Route path="/admin/menu-items" element={<MenuItems />} />
          <Route path="/admin/order-dashboard" element={<OrderDashboard />} />
          <Route path="/admin/qr-generator" element={<QRGenerator />} />
        </>
      )}
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminMain from "./pages/admin/AdminMain";
import Onboarding from "./pages/admin/Onboarding";
import ChangePassword from "./pages/ChangePassword";
import WebMenu from "./pages/customer/WebMenu";
import WebCart from "./pages/customer/WebCart";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <Routes>
      {/* Device-based QR ordering routes */}
      <Route path="/web/:shopId" element={<WebMenu />} />
      <Route path="/web/:shopId/cart" element={<WebCart />} />
      
      {/* Auth routes */}
      {!user ? (
        <>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
        </>
      ) : (
        <>
          {/* Protected admin routes */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/auth" element={<Navigate to="/admin" replace />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/onboarding" element={
            <AuthGuard requireOwner>
              <Onboarding />
            </AuthGuard>
          } />
          <Route path="/dashboard" element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          } />
          <Route path="/admin/*" element={
            <AuthGuard>
              <AdminMain />
            </AuthGuard>
          } />
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
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

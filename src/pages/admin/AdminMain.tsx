import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useUserProfile, PERMISSIONS } from "@/hooks/useUserProfile";
import { PermissionGuard, AccessDenied } from "@/components/admin/PermissionGuard";
import { RoleDashboard } from "@/components/admin/RoleDashboard";
import { Loader2 } from "lucide-react";
import Categories from "./Categories";
import MenuItems from "./MenuItems";
import OrderDashboard from "./OrderDashboard";
import QRGenerator from "./QRGenerator";
import TableSessions from "./TableSessions";
import Settings from "./Settings";
import RolesPermissions from "./RolesPermissions";
import { KitchenDashboard } from "@/components/admin/dashboards/KitchenDashboard";

const getPageInfo = (pathname: string) => {
  switch (pathname) {
    case "/admin":
    case "/admin/dashboard":
      return { title: "Dashboard", description: "Overview and statistics" };
    case "/admin/categories":
      return { title: "Categories", description: "Manage menu categories" };
    case "/admin/menu-items":
      return { title: "Menu Items", description: "Add and manage your menu items" };
    case "/admin/order-dashboard":
      return { title: "Order Dashboard", description: "Monitor live orders" };
    case "/admin/kitchen":
      return { title: "Kitchen", description: "Kitchen order management" };
    case "/admin/table-sessions":
      return { title: "Table Sessions", description: "Manage dining sessions and billing" };
    case "/admin/settings":
      return { title: "Settings", description: "Shop profile and configuration" };
    case "/admin/roles":
      return { title: "Staff Management", description: "Manage staff accounts and roles" };
    case "/admin/permissions":
      return { title: "Roles & Permissions", description: "Configure access control" };
    case "/admin/qr-generator":
      return { title: "QR Generator", description: "Create QR codes for tables" };
    default:
      return { title: "Admin", description: "Restaurant Management" };
  }
};

export default function AdminMain() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, restaurant, isOwner, loading, getDefaultDashboard } = useUserProfile();
  const { title, description } = getPageInfo(location.pathname);
  
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (loading) return;
    
    // Staff users should NEVER be redirected to onboarding
    // Only owners need onboarding check
    if (!isOwner) {
      // Staff - skip onboarding check entirely
      setCheckingOnboarding(false);
      return;
    }

    // Owner: check if onboarding is needed
    if (restaurant && !restaurant.is_onboarded) {
      navigate('/onboarding', { replace: true });
      return;
    }

    // Owner with completed onboarding
    setCheckingOnboarding(false);
  }, [user, restaurant, isOwner, loading, navigate]);

  // Show loader only while loading OR while checking onboarding for owners
  if (loading || (isOwner && checkingOnboarding)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout title={title} description={description}>
      <Routes>
        {/* Dashboard - shows role-appropriate view */}
        <Route index element={<RoleDashboard />} />
        <Route path="dashboard" element={<RoleDashboard />} />
        
        {/* Menu Management - requires menu permissions */}
        <Route path="categories" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.MENU_MANAGE]} 
            fallback={<AccessDenied message="You don't have permission to manage categories." />}
          >
            <Categories />
          </PermissionGuard>
        } />
        <Route path="menu-items" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.MENU_VIEW, PERMISSIONS.MENU_MANAGE]} 
            fallback={<AccessDenied message="You don't have permission to view menu items." />}
          >
            <MenuItems />
          </PermissionGuard>
        } />
        
        {/* Orders - requires order permissions */}
        <Route path="order-dashboard" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.ORDERS_VIEW]} 
            fallback={<AccessDenied message="You don't have permission to view orders." />}
          >
            <OrderDashboard />
          </PermissionGuard>
        } />
        
        {/* Kitchen - requires order status update permission */}
        <Route path="kitchen" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.ORDERS_UPDATE_STATUS]} 
            fallback={<AccessDenied message="You don't have permission to access the kitchen screen." />}
          >
            <KitchenDashboard />
          </PermissionGuard>
        } />
        
        {/* Table Sessions - requires billing or table permissions */}
        <Route path="table-sessions" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.TABLES_VIEW, PERMISSIONS.BILLING_VIEW]} 
            fallback={<AccessDenied message="You don't have permission to view table sessions." />}
          >
            <TableSessions />
          </PermissionGuard>
        } />
        
        {/* Owner-only routes */}
        <Route path="qr-generator" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.QR_MANAGE]} 
            fallback={<AccessDenied message="Only restaurant owners can generate QR codes." />}
          >
            <QRGenerator />
          </PermissionGuard>
        } />
        <Route path="settings" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.SETTINGS_MANAGE]} 
            fallback={<AccessDenied message="Only restaurant owners can access settings." />}
          >
            <Settings />
          </PermissionGuard>
        } />
        <Route path="roles" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.USERS_MANAGE]} 
            fallback={<AccessDenied message="Only restaurant owners can manage staff." />}
          >
            <RolesPermissions />
          </PermissionGuard>
        } />
        <Route path="permissions" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.USERS_MANAGE]} 
            fallback={<AccessDenied message="Only restaurant owners can manage permissions." />}
          >
            <RolesPermissions />
          </PermissionGuard>
        } />
        
        {/* Redirect root admin to dashboard */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}

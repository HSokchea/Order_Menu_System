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
import CustomerOrders from "./CustomerOrders";
import QRGenerator from "./QRGenerator";
import TableSessions from "./TableSessions";
import Settings from "./Settings";
import RolesPermissions from "./RolesPermissions";


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
      return { title: "Order Dashboard", description: "Monitor dine-in table orders" };
    case "/admin/customer-orders":
      return { title: "Customer Orders", description: "QR menu orders (dine-in & takeaway)" };
    case "/admin/table-sessions":
      return { title: "Table Sessions", description: "Manage dining sessions and billing" };
    case "/admin/settings":
      return { title: "Settings", description: "Shop profile and configuration" };
    case "/admin/roles":
      return { title: "Staff Management", description: "Staff, roles & permissions" };
    case "/admin/qr-generator":
      return { title: "QR Generator", description: "Create QR codes for tables" };
    default:
      return { title: "Admin", description: "Restaurant Management" };
  }
};

/**
 * AdminMain - Main admin layout with permission-based route protection
 * 
 * ALL route access is controlled by PERMISSIONS, not role names
 * - Each route specifies required permissions
 * - PermissionGuard checks if user has required permissions
 * - hasPermission() handles owner access automatically
 */
export default function AdminMain() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, restaurant, isOwner, loading, hasPermission } = useUserProfile();
  const { title, description } = getPageInfo(location.pathname);
  
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (loading) return;
    
    // Only owners need onboarding check
    // Staff users skip onboarding entirely
    if (!isOwner) {
      setCheckingOnboarding(false);
      return;
    }

    // Owner: check if onboarding is needed
    if (restaurant && !restaurant.is_onboarded) {
      navigate('/onboarding', { replace: true });
      return;
    }

    setCheckingOnboarding(false);
  }, [user, restaurant, isOwner, loading, navigate]);

  // Show loader while loading OR while checking onboarding for owners
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
        {/* Dashboard - shows permission-appropriate view */}
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
        
        {/* Customer Orders (QR Menu) - requires order permissions */}
        <Route path="customer-orders" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.ORDERS_VIEW]} 
            fallback={<AccessDenied message="You don't have permission to view orders." />}
          >
            <CustomerOrders />
          </PermissionGuard>
        } />
        {/* Table Sessions - requires billing or table permissions */}
        <Route path="table-sessions" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.TABLES_VIEW, PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_COLLECT]} 
            fallback={<AccessDenied message="You don't have permission to view table sessions." />}
          >
            <TableSessions />
          </PermissionGuard>
        } />
        
        {/* QR Generator - requires QR management permission */}
        <Route path="qr-generator" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.QR_MANAGE]} 
            fallback={<AccessDenied message="You don't have permission to generate QR codes." />}
          >
            <QRGenerator />
          </PermissionGuard>
        } />
        
        {/* Settings - requires settings permission */}
        <Route path="settings" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.SETTINGS_MANAGE]} 
            fallback={<AccessDenied message="You don't have permission to access settings." />}
          >
            <Settings />
          </PermissionGuard>
        } />
        
        {/* Staff/Roles Management - requires user management permission */}
        <Route path="roles" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.USERS_MANAGE]} 
            fallback={<AccessDenied message="You don't have permission to manage staff." />}
          >
            <RolesPermissions />
          </PermissionGuard>
        } />
        {/* Redirect old permissions route to unified staff management */}
        <Route path="permissions" element={<Navigate to="/admin/roles" replace />} />
        
        {/* Redirect root admin to dashboard */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}

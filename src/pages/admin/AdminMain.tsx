import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useUserProfile, PERMISSIONS } from "@/hooks/useUserProfile";
import { PermissionGuard, AccessDenied } from "@/components/admin/PermissionGuard";
import { RoleDashboard } from "@/components/admin/RoleDashboard";
import { Loader2 } from "lucide-react";
import Categories from "./Categories";
import MenuItems from "./MenuItems";
import CustomerOrders from "./CustomerOrders";
import OrderDetail from "./OrderDetail";
import QRGenerator from "./QRGenerator";
import Settings from "./Settings";
import RolesPermissions from "./RolesPermissions";
import StaffPage from "./StaffPage";
import RolesPage from "./RolesPage";
import PermissionsPage from "./PermissionsPage";
import UserAccessPage from "./UserAccessPage";
import Inventory from "./Inventory";
import StockAdjustment from "./StockAdjustment";
import InventoryHistory from "./InventoryHistory";

const getPageInfo = (pathname: string) => {
  switch (pathname) {
    case "/admin":
    case "/admin/dashboard":
      return { title: "Dashboard", description: "Overview and statistics" };
    case "/admin/categories":
      return { title: "Categories", description: "Manage menu categories" };
    case "/admin/menu-items":
      return { title: "Menu Items", description: "Add and manage your menu items" };
    case "/admin/customer-orders":
      return { title: "Customer Orders", description: "QR menu orders (dine-in & takeaway)" };
    case "/admin/settings":
      return { title: "Settings", description: "Shop profile and configuration" };
    case "/admin/staff":
      return { title: "Staff", description: "Manage staff accounts" };
    case "/admin/staff/roles":
      return { title: "Roles", description: "Manage roles" };
    case "/admin/staff/permissions":
      return { title: "Permissions", description: "Role permission mapping" };
    case "/admin/staff/user-access":
      return { title: "User Access", description: "View user permissions" };
    case "/admin/roles":
      return { title: "Staff Management", description: "Staff, roles & permissions" };
    case "/admin/qr-generator":
      return { title: "QR Generator", description: "Create QR codes for tables" };
    case "/admin/inventory":
      return { title: "Ingredients", description: "Manage inventory ingredients" };
    case "/admin/inventory/adjustment":
      return { title: "Stock Adjustment", description: "Add or remove stock" };
    case "/admin/inventory/history":
      return { title: "Inventory History", description: "Stock transaction history" };
    default:
      return { title: "Customer Orders", description: "QR menu orders (dine-in & takeaway)" };
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
        
        {/* Customer Orders (QR Menu) - requires order permissions */}
        <Route path="customer-orders" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.ORDERS_VIEW]} 
            fallback={<AccessDenied message="You don't have permission to view orders." />}
          >
            <CustomerOrders />
          </PermissionGuard>
        } />
        <Route path="customer-orders/:orderId" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.ORDERS_VIEW]} 
            fallback={<AccessDenied message="You don't have permission to view orders." />}
          >
            <OrderDetail />
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
        {/* Inventory Management */}
        <Route path="inventory" element={
          <PermissionGuard
            permissions={[PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]}
            fallback={<AccessDenied message="You don't have permission to view inventory." />}
          >
            <Inventory />
          </PermissionGuard>
        } />
        <Route path="inventory/adjustment" element={
          <PermissionGuard
            permissions={[PERMISSIONS.INVENTORY_MANAGE]}
            fallback={<AccessDenied message="You don't have permission to manage inventory." />}
          >
            <StockAdjustment />
          </PermissionGuard>
        } />
        <Route path="inventory/history" element={
          <PermissionGuard
            permissions={[PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]}
            fallback={<AccessDenied message="You don't have permission to view inventory history." />}
          >
            <InventoryHistory />
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

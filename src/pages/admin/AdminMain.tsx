import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { AdminLayout, BreadcrumbItem } from "@/components/admin/AdminLayout";
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

const getBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  // Order detail sub-page
  const orderDetailMatch = pathname.match(/^\/admin\/customer-orders\/(.+)$/);
  if (orderDetailMatch) {
    return [
      { label: "Customer Orders", href: "/admin/customer-orders" },
      { label: `Order Details` },
    ];
  }

  // Staff sub-pages
  if (pathname === "/admin/staff/roles") {
    return [
      { label: "Staff Management", href: "/admin/staff" },
      { label: "Roles" },
    ];
  }
  if (pathname === "/admin/staff/permissions") {
    return [
      { label: "Staff Management", href: "/admin/staff" },
      { label: "Permissions" },
    ];
  }
  if (pathname === "/admin/staff/user-access") {
    return [
      { label: "Staff Management", href: "/admin/staff" },
      { label: "User Access" },
    ];
  }

  // Inventory sub-pages
  if (pathname === "/admin/inventory/adjustment") {
    return [
      { label: "Ingredients", href: "/admin/inventory" },
      { label: "Stock Adjustment" },
    ];
  }
  if (pathname === "/admin/inventory/history") {
    return [
      { label: "Ingredients", href: "/admin/inventory" },
      { label: "Inventory History" },
    ];
  }

  // Top-level pages — single breadcrumb
  const topLevel: Record<string, string> = {
    "/admin": "Dashboard",
    "/admin/dashboard": "Dashboard",
    "/admin/categories": "Categories",
    "/admin/menu-items": "Menu Items",
    "/admin/customer-orders": "Customer Orders",
    "/admin/settings": "Settings",
    "/admin/staff": "Staff Management",
    "/admin/qr-generator": "QR Generator",
    "/admin/inventory": "Ingredients",
    "/admin/roles": "Staff Management",
  };

  const label = topLevel[pathname] || "Dashboard";
  return [{ label }];
};

export default function AdminMain() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, restaurant, isOwner, loading, hasPermission } = useUserProfile();
  const breadcrumbs = getBreadcrumbs(location.pathname);
  
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (loading) return;
    
    if (!isOwner) {
      setCheckingOnboarding(false);
      return;
    }

    if (restaurant && !restaurant.is_onboarded) {
      navigate('/onboarding', { replace: true });
      return;
    }

    setCheckingOnboarding(false);
  }, [user, restaurant, isOwner, loading, navigate]);

  if (loading || (isOwner && checkingOnboarding)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout breadcrumbs={breadcrumbs}>
      <Routes>
        <Route index element={<RoleDashboard />} />
        <Route path="dashboard" element={<RoleDashboard />} />
        
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
        
        <Route path="qr-generator" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.QR_MANAGE]} 
            fallback={<AccessDenied message="You don't have permission to generate QR codes." />}
          >
            <QRGenerator />
          </PermissionGuard>
        } />
        
        <Route path="settings" element={
          <PermissionGuard 
            permissions={[PERMISSIONS.SETTINGS_MANAGE]} 
            fallback={<AccessDenied message="You don't have permission to access settings." />}
          >
            <Settings />
          </PermissionGuard>
        } />
        
        <Route path="staff" element={
          <PermissionGuard
            permissions={[PERMISSIONS.USERS_MANAGE]}
            fallback={<AccessDenied message="You don't have permission to manage staff." />}
          >
            <StaffPage />
          </PermissionGuard>
        } />
        <Route path="staff/roles" element={
          <PermissionGuard
            permissions={[PERMISSIONS.USERS_MANAGE]}
            fallback={<AccessDenied message="You don't have permission to manage roles." />}
          >
            <RolesPage />
          </PermissionGuard>
        } />
        <Route path="staff/permissions" element={
          <PermissionGuard
            permissions={[PERMISSIONS.USERS_MANAGE]}
            fallback={<AccessDenied message="You don't have permission to manage permissions." />}
          >
            <PermissionsPage />
          </PermissionGuard>
        } />
        <Route path="staff/user-access" element={
          <PermissionGuard
            permissions={[PERMISSIONS.USERS_MANAGE]}
            fallback={<AccessDenied message="You don't have permission to view user access." />}
          >
            <UserAccessPage />
          </PermissionGuard>
        } />
        <Route path="roles" element={<Navigate to="/admin/staff" replace />} />
        
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
        
        <Route path="permissions" element={<Navigate to="/admin/roles" replace />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}

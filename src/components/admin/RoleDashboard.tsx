import { useUserProfile, PERMISSIONS } from '@/hooks/useUserProfile';

// Import dashboard components
import Dashboard from '@/pages/Dashboard';
import { KitchenDashboard } from './dashboards/KitchenDashboard';
import { CashierDashboard } from './dashboards/CashierDashboard';

/**
 * RoleDashboard - Renders the appropriate dashboard based on user's PERMISSIONS (not role names)
 * 
 * Access is determined purely by permissions:
 * - reports.view OR dashboard.view → Full Dashboard
 * - billing.collect → Cashier Dashboard  
 * - orders.update.status → Kitchen Dashboard
 * - orders.view → Order Dashboard (cashier-style)
 */
export const RoleDashboard = () => {
  const { hasPermission } = useUserProfile();

  // Full dashboard for users with reports or dashboard access
  if (hasPermission(PERMISSIONS.REPORTS_VIEW) || hasPermission(PERMISSIONS.DASHBOARD_VIEW)) {
    return <Dashboard />;
  }

  // Kitchen dashboard for users with order status update permission
  // but without full dashboard access
  if (hasPermission(PERMISSIONS.ORDERS_UPDATE_STATUS) && !hasPermission(PERMISSIONS.BILLING_COLLECT)) {
    return <KitchenDashboard />;
  }

  // Cashier dashboard for users with billing permissions
  if (hasPermission(PERMISSIONS.BILLING_COLLECT) || hasPermission(PERMISSIONS.BILLING_VIEW)) {
    return <CashierDashboard />;
  }

  // Default: Show cashier dashboard for basic access
  if (hasPermission(PERMISSIONS.ORDERS_VIEW)) {
    return <CashierDashboard />;
  }

  // No permissions - show minimal view
  return <CashierDashboard />;
};

export default RoleDashboard;

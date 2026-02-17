import { useUserProfile, PERMISSIONS } from '@/hooks/useUserProfile';

// Import dashboard components
import Dashboard from '@/pages/Dashboard';

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
};

export default RoleDashboard;

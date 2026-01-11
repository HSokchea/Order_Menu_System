import { useUserProfile, PERMISSIONS } from '@/hooks/useUserProfile';

// Import dashboard components
import Dashboard from '@/pages/Dashboard';
import { KitchenDashboard } from './dashboards/KitchenDashboard';
import { CashierDashboard } from './dashboards/CashierDashboard';

/**
 * RoleDashboard - Renders the appropriate dashboard based on user's role
 */
export const RoleDashboard = () => {
  const { isOwner, getPrimaryRoleType, hasPermission } = useUserProfile();
  const primaryRole = getPrimaryRoleType();

  // Owner and Admin get the full dashboard
  if (isOwner || primaryRole === 'admin') {
    return <Dashboard />;
  }

  // Kitchen staff gets a simplified order view
  if (primaryRole === 'kitchen') {
    return <KitchenDashboard />;
  }

  // Cashier gets billing-focused dashboard
  if (primaryRole === 'cashier') {
    return <CashierDashboard />;
  }

  // Manager, Supervisor, Waiter - show based on permissions
  if (hasPermission(PERMISSIONS.REPORTS_VIEW)) {
    return <Dashboard />;
  }

  // Default: Show a simplified dashboard
  return <CashierDashboard />;
};

export default RoleDashboard;

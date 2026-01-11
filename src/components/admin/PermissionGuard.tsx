import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Loader2, ShieldX } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * PermissionGuard - Protects routes and UI elements based on PERMISSIONS ONLY
 * 
 * IMPORTANT: This guard uses hasPermission() which:
 * - Checks effective permissions from database
 * - Falls back to role-based defaults if needed
 * - Owners automatically have all permissions
 * 
 * NEVER check role names directly - always use permissions
 * 
 * @param permissions - Array of permission keys required
 * @param requireAll - If true, user must have ALL permissions. If false, user needs ANY permission
 * @param fallback - Custom fallback UI when permission denied (default: null for hiding)
 * @param redirectTo - Redirect path when permission denied (overrides fallback)
 */
export const PermissionGuard = ({
  children,
  permissions = [],
  requireAll = false,
  fallback = null,
  redirectTo,
}: PermissionGuardProps) => {
  const { hasAnyPermission, hasAllPermissions, loading } = useUserProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // No permissions required = allow access
  if (permissions.length === 0) {
    return <>{children}</>;
  }

  // Check permissions using the permission-based check
  // Note: hasAnyPermission/hasAllPermissions already handle owner check internally
  const hasAccess = requireAll 
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!hasAccess) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * AccessDenied - Display when user doesn't have required permission
 */
export const AccessDenied = ({ message = "You don't have permission to access this page." }: { message?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <ShieldX className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
      <p className="text-muted-foreground max-w-md">{message}</p>
    </div>
  );
};

/**
 * usePermissionCheck - Hook for conditional rendering based on permissions
 * 
 * Use this for showing/hiding UI elements based on permissions
 * Example: const canEdit = usePermissionCheck([PERMISSIONS.MENU_MANAGE]);
 */
export const usePermissionCheck = (permissions: string[], requireAll = false): boolean => {
  const { hasAnyPermission, hasAllPermissions } = useUserProfile();
  
  if (permissions.length === 0) return true;
  
  return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
};

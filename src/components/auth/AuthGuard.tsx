import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import ChangePassword from '@/pages/ChangePassword';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: ReactNode;
  requireOwner?: boolean;
  requiredPermissions?: string[];
  requireAllPermissions?: boolean;
}

/**
 * AuthGuard - Protects routes using PERMISSION-BASED access control
 * 
 * IMPORTANT: Access is determined by permissions, NOT role names
 * - requiredPermissions: Array of permission keys the user needs
 * - requireAllPermissions: If true, user needs ALL permissions. If false, user needs ANY
 * - requireOwner: Special case for owner-only features (ownership is checked via restaurant.owner_id)
 */
export const AuthGuard = ({ 
  children, 
  requireOwner = false,
  requiredPermissions = [],
  requireAllPermissions = false
}: AuthGuardProps) => {
  const { 
    user, 
    profile, 
    restaurant, 
    isOwner, 
    isActive, 
    mustChangePassword,
    hasAnyPermission,
    hasAllPermissions,
    getDefaultDashboard,
    loading 
  } = useUserProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  // Track if we've already shown the inactive toast to prevent infinite loops
  const hasShownInactiveToast = useRef(false);
  const isRedirecting = useRef(false);

  useEffect(() => {
    if (loading) return;

    // Not authenticated - redirect to login
    if (!user) {
      navigate('/auth', { replace: true, state: { from: location.pathname } });
      return;
    }

    // Check if user is inactive (owners are always active)
    // Use refs to prevent infinite loop of toasts
    if (!isActive && !isRedirecting.current) {
      isRedirecting.current = true;
      
      // Show toast only once
      if (!hasShownInactiveToast.current) {
        hasShownInactiveToast.current = true;
        toast({
          title: "Account Inactive",
          description: "Your account has been deactivated. Please contact your manager.",
          variant: "destructive",
        });
      }
      
      // Sign out and redirect
      signOut().then(() => {
        navigate('/auth', { replace: true });
      });
      return;
    }

    // Check if password change is required (highest priority after auth)
    if (mustChangePassword) {
      setShowPasswordChange(true);
      return;
    }

    // Check if owner is required for this route
    // This is a special ownership check, not a role-name check
    if (requireOwner && !isOwner) {
      toast({
        title: "Access Denied",
        description: "Only restaurant owners can access this page.",
        variant: "destructive",
      });
      navigate(getDefaultDashboard(), { replace: true });
      return;
    }

    // Permission-based access control
    // This is the PRIMARY access check for all routes
    if (requiredPermissions.length > 0) {
      const hasAccess = requireAllPermissions 
        ? hasAllPermissions(requiredPermissions)
        : hasAnyPermission(requiredPermissions);
      
      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate(getDefaultDashboard(), { replace: true });
        return;
      }
    }

    // Reset password change screen if not needed
    setShowPasswordChange(false);
  }, [
    user, 
    profile, 
    isActive, 
    mustChangePassword, 
    isOwner, 
    loading, 
    requireOwner, 
    requiredPermissions, 
    requireAllPermissions,
    hasAnyPermission, 
    hasAllPermissions, 
    getDefaultDashboard, 
    navigate, 
    location.pathname, 
    toast,
    signOut
  ]);

  // Reset refs when user changes (e.g., new login)
  useEffect(() => {
    if (user) {
      hasShownInactiveToast.current = false;
      isRedirecting.current = false;
    }
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If redirecting due to inactive account, show loading
  if (isRedirecting.current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show password change screen
  if (showPasswordChange) {
    return (
      <ChangePassword 
        restaurantName={restaurant?.name}
        onComplete={() => {
          setShowPasswordChange(false);
          navigate(getDefaultDashboard(), { replace: true });
        }}
      />
    );
  }

  return <>{children}</>;
};

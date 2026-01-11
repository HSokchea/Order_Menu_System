import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/hooks/useAuth';
import ChangePassword from '@/pages/ChangePassword';
import { useToast } from '@/hooks/use-toast';

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
  const { signOut } = useAuth();
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
    loading,
    clearState
  } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  // Prevent infinite loops - track if we've already handled inactive state
  const hasHandledInactiveRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    // Not authenticated - redirect to login
    if (!user) {
      navigate('/auth', { replace: true, state: { from: location.pathname } });
      return;
    }

    // Check if user is inactive (owners are always active)
    // Only handle this ONCE to prevent infinite toast loop
    if (!isActive && !hasHandledInactiveRef.current) {
      hasHandledInactiveRef.current = true;
      
      toast({
        title: "Account Inactive",
        description: "Your account has been deactivated. Please contact your manager.",
        variant: "destructive",
      });
      
      // Sign out the user completely
      const handleSignOut = async () => {
        clearState();
        await signOut();
        navigate('/auth', { replace: true });
      };
      
      handleSignOut();
      return;
    }
    
    // If inactive, don't proceed with other checks
    if (!isActive) {
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
    signOut,
    clearState
  ]);

  // Reset the inactive handler ref when user changes
  useEffect(() => {
    hasHandledInactiveRef.current = false;
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is inactive, show nothing while redirecting
  if (!isActive && user) {
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

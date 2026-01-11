import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import ChangePassword from '@/pages/ChangePassword';
import { useToast } from '@/hooks/use-toast';

interface AuthGuardProps {
  children: ReactNode;
  requireOwner?: boolean;
  allowedRoleTypes?: string[];
}

export const AuthGuard = ({ 
  children, 
  requireOwner = false,
  allowedRoleTypes = []
}: AuthGuardProps) => {
  const { 
    user, 
    profile, 
    roles, 
    restaurant, 
    isOwner, 
    isActive, 
    mustChangePassword,
    hasRoleType,
    loading 
  } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  useEffect(() => {
    if (loading) return;

    // Not authenticated - redirect to login
    if (!user) {
      navigate('/auth', { replace: true, state: { from: location.pathname } });
      return;
    }

    // Check if user is inactive
    if (!isActive && !isOwner) {
      toast({
        title: "Account Inactive",
        description: "Your account has been deactivated. Please contact your manager.",
        variant: "destructive",
      });
      navigate('/auth', { replace: true });
      return;
    }

    // Check if password change is required
    if (mustChangePassword) {
      setShowPasswordChange(true);
      return;
    }

    // Check if owner is required
    if (requireOwner && !isOwner) {
      toast({
        title: "Access Denied",
        description: "Only restaurant owners can access this page.",
        variant: "destructive",
      });
      navigate('/admin', { replace: true });
      return;
    }

    // Check role-based access
    if (allowedRoleTypes.length > 0 && !isOwner) {
      const hasAccess = allowedRoleTypes.some(roleType => hasRoleType(roleType));
      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate('/admin', { replace: true });
        return;
      }
    }

    setShowPasswordChange(false);
  }, [user, profile, isActive, mustChangePassword, isOwner, loading, requireOwner, allowedRoleTypes]);

  if (loading) {
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
          navigate('/admin', { replace: true });
        }}
      />
    );
  }

  return <>{children}</>;
};

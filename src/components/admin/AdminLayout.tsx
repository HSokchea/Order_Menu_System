import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogOut, Menu } from "lucide-react";
interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const { signOut } = useAuth();
  const { clearState, profile, user } = useUserProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  
  // Get display name: prefer full_name, fallback to email
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  const handleSignOut = async () => {
    try {
      // 1. Clear all user profile state (roles, permissions, restaurant)
      clearState();
      
      // 2. Clear all React Query cache to prevent data leakage
      queryClient.clear();
      
      // 3. Sign out from Supabase
      const { error } = await signOut();
      if (error) {
        console.warn("Sign out warning:", error);
      }
      
      // 4. Show success toast
      toast.success("You have been successfully signed out.");
      
      // 5. Navigate to login with replace to prevent back-button access
      navigate("/auth", { replace: true });
      
      // 6. Close dialog
      setShowSignOutDialog(false);
      
      // 7. Replace history to prevent back-button to protected pages
      window.history.pushState(null, '', '/auth');
    } catch (err) {
      console.error("Sign out error:", err);
      // Even on error, redirect to auth
      navigate("/auth", { replace: true });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <SidebarInset className="flex-1">
          {/* Top Header */}
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </SidebarTrigger>
                
                {(title || description) && (
                  <div className="hidden sm:block">
                    {title && (
                      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
                    )}
                    {description && (
                      <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowSignOutDialog(true)}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4">
            {children}
          </main>
        </SidebarInset>
        
        <ConfirmDialog
          open={showSignOutDialog}
          onOpenChange={setShowSignOutDialog}
          title="Sign Out"
          description="Are you sure you want to sign out?"
          confirmLabel="Sign Out"
          variant="destructive"
          onConfirm={handleSignOut}
        />
      </div>
    </SidebarProvider>
  );
}
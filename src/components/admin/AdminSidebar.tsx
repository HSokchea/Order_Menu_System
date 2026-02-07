import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  UtensilsCrossed,
  ClipboardList,
  QrCode,
  Store,
  Users,
  Settings,
  CreditCard,
  Package,
  LogOut,
  LucideIcon
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useUserProfile, PERMISSIONS } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Globe, ChevronRight, Check } from "lucide-react";
import { useRef, useLayoutEffect } from "react";

interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
  permissions: string[]; // Required permissions (user needs ANY of these)
}

/**
 * Navigation items with permission requirements
 * Access is controlled purely by permissions - no role name checks
 */
const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutGrid,
    description: "Overview and statistics",
    permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.REPORTS_VIEW],
  },
  {
    title: "Categories",
    url: "/admin/categories",
    icon: LayoutGrid,
    description: "Manage menu categories",
    permissions: [PERMISSIONS.MENU_MANAGE],
  },
  {
    title: "Menu Items",
    url: "/admin/menu-items",
    icon: UtensilsCrossed,
    description: "Add and edit menu items",
    permissions: [PERMISSIONS.MENU_VIEW, PERMISSIONS.MENU_MANAGE],
  },
  {
    title: "Table Orders",
    url: "/admin/order-dashboard",
    icon: ClipboardList,
    description: "Monitor dine-in orders",
    permissions: [PERMISSIONS.ORDERS_VIEW],
  },
  {
    title: "QR Orders",
    url: "/admin/customer-orders",
    icon: Package,
    description: "QR menu orders",
    permissions: [PERMISSIONS.ORDERS_VIEW],
  },
  {
    title: "Table Sessions",
    url: "/admin/table-sessions",
    icon: CreditCard,
    description: "Manage dining sessions",
    permissions: [PERMISSIONS.TABLES_VIEW, PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_COLLECT],
  },
  {
    title: "Generate QR",
    url: "/admin/qr-generator",
    icon: QrCode,
    description: "Create QR codes for tables",
    permissions: [PERMISSIONS.QR_MANAGE],
  },
  {
    title: "Staff Management",
    url: "/admin/roles",
    icon: Users,
    description: "Staff, roles & permissions",
    permissions: [PERMISSIONS.USERS_MANAGE],
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    description: "Shop and receipt settings",
    permissions: [PERMISSIONS.SETTINGS_MANAGE],
  }
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const { hasAnyPermission, restaurant, getPrimaryRoleType, profile, user, clearState } = useUserProfile();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [footerPopoverOpen, setFooterPopoverOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (sidebarRef.current) {
      setSidebarWidth(sidebarRef.current.offsetWidth);
    }
  }, [state]);

  const handleSignOut = async () => {
    try {
      clearState();
      queryClient.clear();
      const { error } = await signOut();
      if (error) console.warn("Sign out warning:", error);
      toast.success("You have been successfully signed out.");
      navigate("/auth", { replace: true });
      setShowSignOutDialog(false);
      window.history.pushState(null, '', '/auth');
    } catch (err) {
      console.error("Sign out error:", err);
      navigate("/auth", { replace: true });
    }
  };

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin" || location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getNavClassName = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${active
      ? "bg-primary/10 text-primary border border-primary/20"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`;
  };

  const visibleItems = navigationItems.filter(item => {
    return hasAnyPermission(item.permissions);
  });

  const displayRole = getPrimaryRoleType();
  const displayRoleLabel = displayRole === 'owner' ? 'Owner' :
    displayRole === 'admin' ? 'Admin' :
      displayRole.charAt(0).toUpperCase() + displayRole.slice(1);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const initials = getInitials(profile?.full_name);

  return (
    <Sidebar ref={sidebarRef} className="border-r border-border/40">
      <SidebarContent className="bg-background flex flex-col h-full p-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b px-6 py-2.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            {state !== "collapsed" && (
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight truncate max-w-[160px]">
                  {restaurant?.name || "Admin"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {displayRoleLabel}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup className="flex-1 p-0 m-0 overflow-y-auto">
          <SidebarGroupContent className="p-0 m-0">
            <SidebarMenu className="p-0 m-0">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title} className="p-0 m-0">
                  <SidebarMenuButton asChild className="h-auto p-0">
                    <NavLink to={item.url} className={getNavClassName(item.url)}>
                      <item.icon className={`h-5 w-5 ${state === "collapsed" ? "mx-auto" : ""}`} />
                      {state !== "collapsed" && (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </div>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer – User profile with popover */}
        <Popover open={footerPopoverOpen} onOpenChange={setFooterPopoverOpen}>
          <PopoverTrigger asChild>
            <div
              className={`shrink-0 border-t px-3 py-3 transition-colors hover:bg-muted/50 cursor-pointer flex items-center gap-3 ${state === "collapsed" ? "justify-center" : ""
                }`}
              tabIndex={0}
              role="button"
              aria-label="User menu"
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary leading-none">
                  {initials}
                </span>
              </div>

              {state !== "collapsed" && (
                <div className="flex flex-col justify-center gap-0.5 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate leading-tight">
                    {displayEmail}
                  </p>
                </div>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="p-1 shadow-none"
            style={sidebarWidth ? { width: sidebarWidth - 20 } : undefined}
            sideOffset={8}
          >
            <div className="space-y-1">
              {/* Language Selector with Nested Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-accent transition-colors text-left">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1">Language</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{language === 'en' ? 'English' : 'ភាសាខ្មែរ'}</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  className="w-48 p-1 shadow-none"
                  sideOffset={12}
                >
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        setLanguage('en');
                        setFooterPopoverOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${language === 'en'
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                        }`}
                    >
                      <div className="flex-1 text-left">English</div>
                      {language === 'en' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setLanguage('km');
                        setFooterPopoverOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${language === 'km'
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                        }`}
                    >
                      <div className="flex-1 text-left">ភាសាខ្មែរ</div>
                      {language === 'km' && (
                        <Check className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              <div className="border-t" />

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm gap-2 px-2 text-destructive hover:text-destructive"
                onClick={() => {
                  setFooterPopoverOpen(false);
                  setShowSignOutDialog(true);
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <ConfirmDialog
          open={showSignOutDialog}
          onOpenChange={setShowSignOutDialog}
          title="Sign Out"
          description="Are you sure you want to sign out?"
          confirmLabel="Sign Out"
          variant="destructive"
          onConfirm={handleSignOut}
        />
      </SidebarContent>
    </Sidebar>
  );
}

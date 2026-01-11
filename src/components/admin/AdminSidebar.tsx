import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  UtensilsCrossed,
  ClipboardList,
  QrCode,
  Store,
  Users,
  Settings,
  Shield,
  CreditCard,
  ChefHat,
  LucideIcon
} from "lucide-react";

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

interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
  permissions?: string[];
  ownerOnly?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutGrid,
    description: "Overview and statistics",
    permissions: [PERMISSIONS.REPORTS_VIEW],
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
    title: "View Orders",
    url: "/admin/order-dashboard", 
    icon: ClipboardList,
    description: "Monitor live orders",
    permissions: [PERMISSIONS.ORDERS_VIEW],
  },
  {
    title: "Kitchen",
    url: "/admin/kitchen",
    icon: ChefHat,
    description: "Kitchen order screen",
    permissions: [PERMISSIONS.ORDERS_UPDATE_STATUS],
  },
  {
    title: "Table Sessions",
    url: "/admin/table-sessions",
    icon: CreditCard,
    description: "Manage dining sessions",
    permissions: [PERMISSIONS.TABLES_VIEW, PERMISSIONS.BILLING_VIEW],
  },
  {
    title: "Generate QR",
    url: "/admin/qr-generator",
    icon: QrCode,
    description: "Create QR codes for tables",
    permissions: [PERMISSIONS.QR_MANAGE],
    ownerOnly: true,
  },
  {
    title: "Staff Management",
    url: "/admin/roles",
    icon: Users,
    description: "Manage staff accounts",
    permissions: [PERMISSIONS.USERS_MANAGE],
    ownerOnly: true,
  },
  {
    title: "Roles & Permissions",
    url: "/admin/permissions",
    icon: Shield,
    description: "Configure access control",
    permissions: [PERMISSIONS.USERS_MANAGE],
    ownerOnly: true,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    description: "Shop and receipt settings",
    permissions: [PERMISSIONS.SETTINGS_MANAGE],
    ownerOnly: true,
  }
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { isOwner, hasPermission, hasAnyPermission, restaurant } = useUserProfile();
  
  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin" || location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getNavClassName = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
      active 
        ? "bg-primary/10 text-primary border border-primary/20" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;
  };

  // Filter navigation items based on user permissions
  const visibleItems = navigationItems.filter(item => {
    // Owner has access to everything
    if (isOwner) return true;
    
    // Owner-only items are hidden for non-owners
    if (item.ownerOnly) return false;
    
    // Check permissions
    if (item.permissions && item.permissions.length > 0) {
      return hasAnyPermission(item.permissions);
    }
    
    return true;
  });

  return (
    <Sidebar className="border-r border-border/40">
      <SidebarContent className="bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-2.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            {state !== "collapsed" && (
              <div>
                <h2 className="text-lg font-semibold tracking-tight truncate max-w-[160px]">
                  {restaurant?.name || 'Admin'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isOwner ? 'Owner' : 'Staff'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-auto p-0">
                    <NavLink to={item.url} className={getNavClassName(item.url)}>
                      <item.icon className={`h-5 w-5 ${state === "collapsed" ? 'mx-auto' : ''}`} />
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
      </SidebarContent>
    </Sidebar>
  );
}

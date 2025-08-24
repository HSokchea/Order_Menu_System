import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  UtensilsCrossed,
  ClipboardList,
  QrCode,
  Store,
  BarChart3,
  Package,
  Gift
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutGrid,
    description: "Overview and statistics"
  },
  {
    title: "Categories",
    url: "/admin/categories",
    icon: LayoutGrid,
    description: "Manage menu categories"
  },
  {
    title: "Menu Items", 
    url: "/admin/menu-items",
    icon: UtensilsCrossed,
    description: "Add and edit menu items"
  },
  {
    title: "View Orders",
    url: "/admin/order-dashboard", 
    icon: ClipboardList,
    description: "Monitor live orders"
  },
  {
    title: "Analytics",
    url: "/admin/analytics",
    icon: BarChart3,
    description: "Advanced insights and metrics"
  },
  {
    title: "Stock Management",
    url: "/admin/stock",
    icon: Package,
    description: "Track inventory levels"
  },
  {
    title: "Promotions & Discounts",
    url: "/admin/promotions",
    icon: Gift,
    description: "Manage special offers"
  }
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  
  const isActive = (path: string) => {
    // Make Dashboard active for root paths
    if (path === "/admin") {
      return location.pathname === "/admin" || location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === path;
  };

  const getNavClassName = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
      active 
        ? "bg-primary/10 text-primary border border-primary/20" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;
  };

  return (
    <Sidebar className="border-r border-border/40">
      <SidebarContent className="bg-background">
        {/* Header */}
        <div className="p-6 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            {state !== "collapsed" && (
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Admin</h2>
                <p className="text-xs text-muted-foreground">Restaurant Management</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup className="px-4 py-6">
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navigationItems.map((item) => (
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
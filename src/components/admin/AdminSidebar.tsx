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
  Package,
  LogOut,
  LucideIcon,
  Warehouse,
  PackagePlus,
  History,
  ChevronDown,
  UserCog,
  Shield,
  Key,
  PanelLeftClose,
  PanelLeft,
  Globe,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useUserProfile, PERMISSIONS } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  permissions: string[];
}

interface NavigationGroup {
  title: string;
  icon: LucideIcon;
  permissions: string[];
  children: NavigationItem[];
}

type NavEntry = NavigationItem | NavigationGroup;

function isGroup(entry: NavEntry): entry is NavigationGroup {
  return "children" in entry;
}

const navigationEntries: NavEntry[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutGrid,
    permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.REPORTS_VIEW],
  },
  {
    title: "Categories",
    url: "/admin/categories",
    icon: LayoutGrid,
    permissions: [PERMISSIONS.MENU_MANAGE],
  },
  {
    title: "Menu Items",
    url: "/admin/menu-items",
    icon: UtensilsCrossed,
    permissions: [PERMISSIONS.MENU_VIEW, PERMISSIONS.MENU_MANAGE],
  },
  {
    title: "QR Orders",
    url: "/admin/customer-orders",
    icon: Package,
    permissions: [PERMISSIONS.ORDERS_VIEW],
  },
  {
    title: "Generate QR",
    url: "/admin/qr-generator",
    icon: QrCode,
    permissions: [PERMISSIONS.QR_MANAGE],
  },
  {
    title: "Inventory",
    icon: Warehouse,
    permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE],
    children: [
      {
        title: "Ingredients",
        url: "/admin/inventory",
        icon: Warehouse,
        permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE],
      },
      {
        title: "Stock Adjustment",
        url: "/admin/inventory/adjustment",
        icon: PackagePlus,
        permissions: [PERMISSIONS.INVENTORY_MANAGE],
      },
      {
        title: "Inventory History",
        url: "/admin/inventory/history",
        icon: History,
        permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE],
      },
    ],
  },
  {
    title: "Staff Management",
    icon: Users,
    permissions: [PERMISSIONS.USERS_MANAGE],
    children: [
      {
        title: "Staff",
        url: "/admin/staff",
        icon: UserCog,
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
      {
        title: "Roles",
        url: "/admin/staff/roles",
        icon: Shield,
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
      {
        title: "Permissions",
        url: "/admin/staff/permissions",
        icon: Key,
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
      {
        title: "User Access",
        url: "/admin/staff/user-access",
        icon: Users,
        permissions: [PERMISSIONS.USERS_MANAGE],
      },
    ],
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    permissions: [PERMISSIONS.SETTINGS_MANAGE],
  },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export function AdminSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const {
    hasAnyPermission,
    restaurant,
    getPrimaryRoleType,
    profile,
    user,
    clearState,
  } = useUserProfile();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [language, setLanguage] = useState<"en" | "km">(() => {
    return (localStorage.getItem("app_language") as "en" | "km") || "en";
  });
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => ({
    Inventory: location.pathname.startsWith("/admin/inventory"),
    "Staff Management": location.pathname.startsWith("/admin/staff"),
  }));

  const handleLanguageChange = (lang: "en" | "km") => {
    setLanguage(lang);
    localStorage.setItem("app_language", lang);
  };

  const handleSignOut = async () => {
    try {
      clearState();
      queryClient.clear();
      const { error } = await signOut();
      if (error) console.warn("Sign out warning:", error);
      toast.success("You have been successfully signed out.");
      navigate("/auth", { replace: true });
      setShowSignOutDialog(false);
      window.history.pushState(null, "", "/auth");
    } catch (err) {
      console.error("Sign out error:", err);
      navigate("/auth", { replace: true });
    }
  };

  const isActive = (path: string) => {
    if (path === "/admin") {
      return (
        location.pathname === "/admin" ||
        location.pathname === "/" ||
        location.pathname === "/dashboard"
      );
    }
    if (path === "/admin/inventory") return location.pathname === "/admin/inventory";
    if (path === "/admin/staff") return location.pathname === "/admin/staff";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const visibleEntries = navigationEntries.filter((entry) =>
    hasAnyPermission(entry.permissions)
  );

  const displayRole = getPrimaryRoleType();
  const displayRoleLabel =
    displayRole === "owner"
      ? "Owner"
      : displayRole === "admin"
        ? "Admin"
        : displayRole.charAt(0).toUpperCase() + displayRole.slice(1);

  const displayName =
    profile?.full_name || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";
  const initials = getInitials(profile?.full_name);

  const renderNavItem = (item: NavigationItem, indent = false) => {
    const active = isActive(item.url);

    const link = (
      <NavLink
        to={item.url}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        } ${indent && !collapsed ? "pl-9" : ""}`}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <SidebarMenuItem key={item.title} className="p-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton asChild className="h-auto p-0">
                {link}
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {item.title}
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.title} className="p-0">
        <SidebarMenuButton asChild className="h-auto p-0">
          {link}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: NavigationGroup) => {
    const visibleChildren = group.children.filter((c) =>
      hasAnyPermission(c.permissions)
    );
    if (visibleChildren.length === 0) return null;
    const groupActive = visibleChildren.some((c) => isActive(c.url));
    const isOpen = groupOpen[group.title] ?? false;
    const toggleGroup = (open: boolean) =>
      setGroupOpen((prev) => ({ ...prev, [group.title]: open }));

    if (collapsed) {
      // In collapsed mode, show only the group icon with tooltip
      const firstChild = visibleChildren[0];
      return (
        <SidebarMenuItem key={group.title} className="p-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton asChild className="h-auto p-0">
                <NavLink
                  to={firstChild.url}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    groupActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <group.icon className="h-[18px] w-[18px] shrink-0" />
                </NavLink>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {group.title}
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible
        key={group.title}
        open={isOpen}
        onOpenChange={toggleGroup}
      >
        <SidebarMenuItem className="p-0">
          <CollapsibleTrigger asChild>
            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                groupActive && !isOpen
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <group.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 truncate text-left">{group.title}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </CollapsibleTrigger>
        </SidebarMenuItem>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out]">
          {visibleChildren.map((child) => renderNavItem(child, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-0">
        {/* Brand header with inline toggle - Claude style */}
        <div className={`flex items-center gap-2 px-3 py-3 ${collapsed ? "justify-center" : ""}`}>
          {!collapsed ? (
            <>
              <div className="h-8 w-8 shrink-0 rounded-lg bg-primary flex items-center justify-center">
                <Store className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold tracking-tight truncate text-sidebar-foreground">
                  {restaurant?.name || "Admin"}
                </h2>
                <p className="text-xs text-sidebar-foreground/50">
                  {displayRoleLabel}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSidebar}
                    className="shrink-0 rounded-lg p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                  >
                    <PanelLeftClose className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  Close sidebar
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="rounded-lg p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  <PanelLeft className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                Open sidebar
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-0 w-full" />

      <SidebarContent className="p-0 gap-0">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="px-2 py-1 gap-0.5">
              {visibleEntries.map((entry) =>
                isGroup(entry) ? renderGroup(entry) : renderNavItem(entry)
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0 mt-auto">
        <SidebarSeparator className="mx-0 w-full" />

        {/* User profile with popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={`flex items-center gap-3 px-3 py-3 w-full hover:bg-sidebar-accent/50 transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-xs font-semibold text-sidebar-foreground leading-none">
                  {initials}
                </span>
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium truncate text-sidebar-foreground leading-tight">
                    {displayName}
                  </p>
                  <p className="text-xs text-sidebar-foreground/50 truncate leading-tight">
                    {displayEmail}
                  </p>
                </div>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-56 p-1"
            sideOffset={8}
          >
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{displayRoleLabel}</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                  <Globe className="h-4 w-4" />
                  <span className="flex-1 text-left">Language</span>
                  <span className="text-xs text-muted-foreground">
                    {language === "en" ? "English" : "ខ្មែរ"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                className="w-44 p-1"
                sideOffset={8}
              >
                <button
                  onClick={() => handleLanguageChange("en")}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <span className="flex-1 text-left">English</span>
                  {language === "en" && <Check className="h-4 w-4 text-primary" />}
                </button>
                <button
                  onClick={() => handleLanguageChange("km")}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <span className="flex-1 text-left">ខ្មែរ (Khmer)</span>
                  {language === "km" && <Check className="h-4 w-4 text-primary" />}
                </button>
              </PopoverContent>
            </Popover>
            <button
              onClick={() => setShowSignOutDialog(true)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </PopoverContent>
        </Popover>
      </SidebarFooter>

      <ConfirmDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        variant="destructive"
        onConfirm={handleSignOut}
      />
    </Sidebar>
  );
}

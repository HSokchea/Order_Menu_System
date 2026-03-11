import { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminLayoutProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function AdminLayout({ children, breadcrumbs }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />

        <SidebarInset className="flex-1">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <header className="sticky top-0 z-11 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-12 items-center px-6">
                <nav className="flex items-center gap-1.5 text-sm">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    return (
                      <div key={index} className="flex items-center gap-1.5">
                        {index > 0 && (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                        )}
                        {crumb.href && !isLast ? (
                          <Link
                            to={crumb.href}
                            className={cn(
                              "text-muted-foreground hover:text-foreground transition-colors",
                              "truncate max-w-[200px]"
                            )}
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span
                            className={cn(
                              "truncate max-w-[300px]",
                              isLast
                                ? "text-foreground font-medium"
                                : "text-muted-foreground"
                            )}
                          >
                            {crumb.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </header>
          )}

          <main className="flex-1 p-4">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

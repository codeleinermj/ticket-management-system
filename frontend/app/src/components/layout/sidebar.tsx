"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useLogout } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

import { UserRole } from "@/types";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tickets", href: "/dashboard/tickets", icon: Ticket },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);
  const [collapsed, setCollapsed] = useState(false);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">TicketAI</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const link = (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}

        {user?.role === UserRole.ADMIN && (
          <>
            <Separator className="my-2" />
            {(() => {
              const adminActive = pathname.startsWith("/dashboard/admin");
              const adminLink = (
                <Link
                  href="/dashboard/admin/users"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    adminActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Usuarios</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip>
                    <TooltipTrigger>{adminLink}</TooltipTrigger>
                    <TooltipContent side="right">Usuarios</TooltipContent>
                  </Tooltip>
                );
              }
              return adminLink;
            })()}
          </>
        )}
      </nav>

      <Separator />

      <div className="p-2">
        <div
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.role}
              </p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                "cursor-pointer disabled:opacity-50"
              )}
            >
              <LogOut className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">Cerrar sesion</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

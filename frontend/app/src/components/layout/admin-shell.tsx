"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/hooks/use-auth";
import { useSocketConnection } from "@/hooks/use-socket";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "./admin-sidebar";
import { NotificationDropdown } from "./notification-dropdown";
import { Skeleton } from "@/components/ui/skeleton";

const routeTitles: Record<string, string> = {
  "/admin": "Dashboard Administrativo",
  "/admin/tickets": "Gestion de Tickets",
  "/admin/users": "Administrar Usuarios",
  "/admin/settings": "Configuracion",
  "/admin/profile": "Mi Perfil",
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useUser();
  const logoutStore = useAuthStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();
  const didLogout = useRef(false);

  useSocketConnection();

  useEffect(() => {
    if (isError && !isLoading && !didLogout.current) {
      didLogout.current = true;
      api.logout().catch(() => {}).finally(() => {
        logoutStore();
        router.push("/login");
      });
    }
  }, [isError, isLoading, logoutStore, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="mx-auto h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return null;
  }

  const title =
    routeTitles[pathname] ||
    (pathname.startsWith("/admin/tickets/") ? "Detalle de Ticket" : "Admin");

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-2">
            <NotificationDropdown />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

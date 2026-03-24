"use client";

import { usePathname } from "next/navigation";
import { NotificationDropdown } from "./notification-dropdown";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/tickets": "Tickets",
  "/dashboard/profile": "Mi Perfil",
};

export function Header() {
  const pathname = usePathname();

  const title =
    routeTitles[pathname] ||
    (pathname.startsWith("/dashboard/tickets/") ? "Detalle de Ticket" : "Dashboard");

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <NotificationDropdown />
      </div>
    </header>
  );
}

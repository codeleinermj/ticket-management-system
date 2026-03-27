"use client";

import { usePathname } from "next/navigation";
import { NotificationDropdown } from "./notification-dropdown";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { motion } from "framer-motion";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/tickets": "Tickets",
  "/dashboard/profile": "Mi Perfil",
  "/admin": "Administración",
  "/admin/users": "Usuarios",
  "/admin/settings": "Configuración",
  "/portal": "Mi Portal",
};

export function Header() {
  const pathname = usePathname();

  const title =
    routeTitles[pathname] ||
    (pathname.includes("/tickets/") ? "Detalle de Ticket" : "Dashboard");

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/50 backdrop-blur-sm px-6 sticky top-0 z-40">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          {title}
        </h1>
      </motion.div>

      <div className="flex items-center gap-3">
        <NotificationDropdown />
        <ThemeToggle />
      </div>
    </header>
  );
}

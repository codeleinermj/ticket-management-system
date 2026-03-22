"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/hooks/use-auth";
import { useSocketConnection } from "@/hooks/use-socket";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useUser();
  const logoutStore = useAuthStore((s) => s.logout);
  const router = useRouter();
  const didLogout = useRef(false);

  useSocketConnection();

  // If auth fails, clear stale cookies and redirect to login (once)
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

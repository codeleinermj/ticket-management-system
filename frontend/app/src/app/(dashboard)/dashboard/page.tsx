"use client";

import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentTickets } from "@/components/dashboard/recent-tickets";
import { useTickets } from "@/hooks/use-tickets";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiStatus, TicketStatus } from "@/types";
import { AlertTriangle, Brain, UserCheck } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/tickets/status-badge";

export default function DashboardPage() {
  const { data } = useTickets();
  const user = useAuthStore((s) => s.user);

  const tickets = data?.data?.data || [];
  const myTickets = tickets.filter((t) => t.assignedToId === user?.id).length;
  const unassigned = tickets.filter((t) => !t.assignedToId && t.status === TicketStatus.OPEN);
  const aiFailed = tickets.filter((t) => t.aiStatus === AiStatus.FAILED);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Resumen general del sistema de tickets
        </p>
      </div>

      <StatsCards />

      {/* Agent-specific stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis Asignados</CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myTickets}</div>
            <p className="text-xs text-muted-foreground">Tickets asignados a ti</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Asignar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unassigned.length}</div>
            <p className="text-xs text-muted-foreground">Esperando asignacion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IA Fallida</CardTitle>
            <Brain className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiFailed.length}</div>
            <p className="text-xs text-muted-foreground">Revision manual</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTickets basePath="/dashboard" />

        {/* Unassigned tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets Sin Asignar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {unassigned.slice(0, 5).map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/dashboard/tickets/${ticket.id}`}
                  className="flex items-center justify-between rounded-md p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm font-medium leading-none truncate">
                      {ticket.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.createdBy?.name}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                </Link>
              ))}
              {unassigned.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Todos los tickets estan asignados
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

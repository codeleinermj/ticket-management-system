"use client";

import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentTickets } from "@/components/dashboard/recent-tickets";
import { useTickets } from "@/hooks/use-tickets";
import { useUsers } from "@/hooks/use-users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiStatus, TicketStatus } from "@/types";
import { Users, AlertTriangle, Brain, Clock } from "lucide-react";

export default function AdminDashboardPage() {
  const { data: ticketData } = useTickets();
  const { data: userData } = useUsers({ page: 1 });

  const tickets = ticketData?.data?.data || [];
  const totalUsers = userData?.data?.meta?.total || 0;

  const unassigned = tickets.filter((t) => !t.assignedToId && t.status === TicketStatus.OPEN).length;
  const aiFailed = tickets.filter((t) => t.aiStatus === AiStatus.FAILED).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard Administrativo</h2>
        <p className="text-muted-foreground">
          Vista general del sistema
        </p>
      </div>

      <StatsCards />

      {/* Admin-specific stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registrados en el sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Asignar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unassigned}</div>
            <p className="text-xs text-muted-foreground">Tickets sin agente asignado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IA Fallida</CardTitle>
            <Brain className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiFailed}</div>
            <p className="text-xs text-muted-foreground">Requieren revision manual</p>
          </CardContent>
        </Card>
      </div>

      <RecentTickets basePath="/admin" />
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTickets } from "@/hooks/use-tickets";
import { TicketStatus } from "@/types";
import {
  Inbox,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

export function StatsCards() {
  const { data, isLoading } = useTickets();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const tickets = data?.data?.data || [];
  const total = data?.data?.meta?.total || 0;
  const open = tickets.filter((t) => t.status === TicketStatus.OPEN).length;
  const inProgress = tickets.filter(
    (t) => t.status === TicketStatus.IN_PROGRESS
  ).length;
  const resolved = tickets.filter(
    (t) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED
  ).length;
  const pendingReview = tickets.filter(
    (t) => t.status === TicketStatus.PENDING_MANUAL_REVIEW
  ).length;

  const stats = [
    {
      title: "Total Tickets",
      value: total,
      icon: Inbox,
      description: "En el sistema",
    },
    {
      title: "Abiertos",
      value: open,
      icon: Clock,
      description: "Pendientes de atencion",
    },
    {
      title: "En Progreso",
      value: inProgress + pendingReview,
      icon: AlertTriangle,
      description: "Siendo atendidos",
    },
    {
      title: "Resueltos",
      value: resolved,
      icon: CheckCircle,
      description: "Completados",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTickets } from "@/hooks/use-tickets";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RecentTickets() {
  const { data, isLoading } = useTickets();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tickets Recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const tickets = data?.data?.data?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/tickets/${ticket.id}`}
              className="flex items-center justify-between rounded-md p-2 transition-colors hover:bg-muted/50"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {ticket.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ticket.createdBy?.name} &middot;{" "}
                  {new Date(ticket.createdAt).toLocaleDateString("es-ES")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </div>
            </Link>
          ))}
          {tickets.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No hay tickets recientes
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTicket } from "@/hooks/use-tickets";
import { setActiveTicketId } from "@/hooks/use-socket";
import { TicketComments } from "@/components/tickets/ticket-comments";
import { StatusBadge } from "@/components/tickets/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";

export default function PortalTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, isError } = useTicket(id);

  useEffect(() => {
    setActiveTicketId(id);
    return () => setActiveTicketId(null);
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium">Ticket no encontrado</p>
        <Button variant="ghost" onClick={() => router.push("/portal")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  const ticket = data.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/portal")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{ticket.title}</h2>
          <p className="text-sm text-muted-foreground">
            Creado el{" "}
            {new Date(ticket.createdAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Descripcion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {ticket.description}
          </p>
        </CardContent>
      </Card>

      {/* Conversation */}
      <TicketComments ticketId={id} />
    </div>
  );
}

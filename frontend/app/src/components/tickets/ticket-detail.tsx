"use client";

import { useRouter } from "next/navigation";
import { useTicket, useUpdateTicket, useDeleteTicket } from "@/hooks/use-tickets";
import { useAuthStore } from "@/stores/auth";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { AiSuggestion } from "./ai-suggestion";
import { TicketAuditLog } from "./ticket-audit-log";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketStatus, UserRole } from "@/types";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useTicket(ticketId);
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const user = useAuthStore((s) => s.user);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium">Ticket no encontrado</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  const ticket = data.data;
  const isAgent = user?.role === UserRole.AGENT || user?.role === UserRole.ADMIN;

  const handleStatusChange = (status: TicketStatus) => {
    updateTicket.mutate(
      { id: ticketId, data: { status } },
      {
        onSuccess: () => toast.success("Estado actualizado"),
        onError: () => toast.error("Error al actualizar"),
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Estas seguro de eliminar este ticket?")) return;
    deleteTicket.mutate(ticketId, {
      onSuccess: () => {
        toast.success("Ticket eliminado");
        router.push("/dashboard/tickets");
      },
      onError: () => toast.error("Error al eliminar"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{ticket.title}</h2>
          <p className="text-sm text-muted-foreground">
            Creado por {ticket.createdBy?.name} el{" "}
            {new Date(ticket.createdAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        {user?.role === UserRole.ADMIN && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteTicket.isPending}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Eliminar
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
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

          <AiSuggestion
            ticketId={ticketId}
            aiResponse={ticket.aiResponse}
            aiStatus={ticket.aiStatus}
            confidence={ticket.confidence}
            category={ticket.category}
            priority={ticket.priority}
            isAgent={isAgent}
          />

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
              <CardDescription>
                Registro de cambios del ticket
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TicketAuditLog logs={ticket.auditLogs || []} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado</span>
                {isAgent ? (
                  <Select
                    value={ticket.status}
                    onValueChange={(v) =>
                      handleStatusChange(v as TicketStatus)
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TicketStatus.OPEN}>
                        Abierto
                      </SelectItem>
                      <SelectItem value={TicketStatus.IN_PROGRESS}>
                        En Progreso
                      </SelectItem>
                      <SelectItem value={TicketStatus.RESOLVED}>
                        Resuelto
                      </SelectItem>
                      <SelectItem value={TicketStatus.CLOSED}>
                        Cerrado
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusBadge status={ticket.status} />
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Prioridad</span>
                <PriorityBadge priority={ticket.priority} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Categoria</span>
                <span className="text-sm font-medium">{ticket.category || "Pendiente de IA"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Asignado a
                </span>
                <span className="text-sm font-medium">
                  {ticket.assignedTo?.name || "Sin asignar"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Actualizado
                </span>
                <span className="text-sm">
                  {new Date(ticket.updatedAt).toLocaleDateString("es-ES")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

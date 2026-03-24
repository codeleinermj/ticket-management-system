"use client";

import { useState } from "react";
import Link from "next/link";
import { useTickets, useBulkAction } from "@/hooks/use-tickets";
import { useAgents } from "@/hooks/use-users";
import { useFiltersStore } from "@/stores/filters";
import { useAuthStore } from "@/stores/auth";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { TicketTableSkeleton } from "./ticket-table-skeleton";
import { SlaIndicator } from "./sla-indicator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { AiStatus, TicketPriority, TicketStatus, UserRole } from "@/types";
import { toast } from "sonner";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const categoryLabels: Record<string, string> = {
  BUG: "Bug",
  FEATURE_REQUEST: "Feature",
  SUPPORT: "Soporte",
  BILLING: "Facturacion",
  OTHER: "Otro",
};

const aiStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "outline" },
  CLASSIFIED: { label: "Clasificado", variant: "default" },
  FAILED: { label: "Fallido", variant: "destructive" },
};

interface TicketTableProps {
  basePath?: string;
}

export function TicketTable({ basePath = "/dashboard" }: TicketTableProps) {
  const { data, isLoading, isError } = useTickets();
  const { page, setPage, selectedTickets, toggleTicketSelection, selectAllTickets, clearSelectedTickets } = useFiltersStore();
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === UserRole.AGENT || user?.role === UserRole.ADMIN;
  const isAdmin = user?.role === UserRole.ADMIN;

  const bulkAction = useBulkAction();
  const { data: agentsData } = useAgents();
  const agents = agentsData?.data || [];

  const [bulkActionType, setBulkActionType] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");

  if (isLoading) return <TicketTableSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Error al cargar los tickets</p>
      </div>
    );
  }

  const tickets = data?.data?.data || [];
  const meta = data?.data?.meta;

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Inbox className="mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No hay tickets</p>
        <p className="text-sm">Crea un nuevo ticket para empezar</p>
      </div>
    );
  }

  const allSelected = tickets.every((t) => selectedTickets.has(t.id));
  const someSelected = selectedTickets.size > 0;

  const handleSelectAll = () => {
    if (allSelected) clearSelectedTickets();
    else selectAllTickets(tickets.map((t) => t.id));
  };

  const handleBulkExecute = () => {
    if (!bulkActionType || selectedTickets.size === 0) return;

    const ticketIds = Array.from(selectedTickets);
    let actionData: any = {};

    switch (bulkActionType) {
      case "update_status":
        if (!bulkValue) return toast.error("Selecciona un estado");
        actionData = { status: bulkValue };
        break;
      case "assign":
        if (!bulkValue) return toast.error("Selecciona un agente");
        actionData = { assignedToId: bulkValue };
        break;
      case "update_priority":
        if (!bulkValue) return toast.error("Selecciona una prioridad");
        actionData = { priority: bulkValue };
        break;
      case "delete":
        if (!confirm(`Eliminar ${ticketIds.length} tickets?`)) return;
        break;
    }

    bulkAction.mutate(
      { ticketIds, action: bulkActionType as any, data: actionData },
      {
        onSuccess: (res) => {
          toast.success(`${res.data.processed} tickets procesados`);
          clearSelectedTickets();
          setBulkActionType("");
          setBulkValue("");
        },
        onError: () => toast.error("Error en accion bulk"),
      }
    );
  };

  return (
    <div>
      {isAgent && someSelected && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedTickets.size} ticket{selectedTickets.size > 1 ? "s" : ""} seleccionado{selectedTickets.size > 1 ? "s" : ""}
          </span>

          <Select value={bulkActionType} onValueChange={(v) => { setBulkActionType(v || ""); setBulkValue(""); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Accion..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="update_status">Cambiar estado</SelectItem>
              <SelectItem value="assign">Asignar a agente</SelectItem>
              <SelectItem value="update_priority">Cambiar prioridad</SelectItem>
              {isAdmin && <SelectItem value="delete">Eliminar</SelectItem>}
            </SelectContent>
          </Select>

          {bulkActionType === "update_status" && (
            <Select value={bulkValue} onValueChange={(v) => setBulkValue(v || "")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TicketStatus.OPEN}>Abierto</SelectItem>
                <SelectItem value={TicketStatus.IN_PROGRESS}>En Progreso</SelectItem>
                <SelectItem value={TicketStatus.RESOLVED}>Resuelto</SelectItem>
                <SelectItem value={TicketStatus.CLOSED}>Cerrado</SelectItem>
              </SelectContent>
            </Select>
          )}

          {bulkActionType === "assign" && (
            <Select value={bulkValue} onValueChange={(v) => setBulkValue(v || "")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {bulkActionType === "update_priority" && (
            <Select value={bulkValue} onValueChange={(v) => setBulkValue(v || "")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TicketPriority.LOW}>Baja</SelectItem>
                <SelectItem value={TicketPriority.MEDIUM}>Media</SelectItem>
                <SelectItem value={TicketPriority.HIGH}>Alta</SelectItem>
                <SelectItem value={TicketPriority.CRITICAL}>Critica</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            onClick={handleBulkExecute}
            disabled={bulkAction.isPending || !bulkActionType}
          >
            {bulkAction.isPending ? "Procesando..." : "Aplicar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { clearSelectedTickets(); setBulkActionType(""); }}>
            Cancelar
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {isAgent && (
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                </TableHead>
              )}
              <TableHead>Titulo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Asignado a</TableHead>
              {isAgent && <TableHead>SLA</TableHead>}
              <TableHead>IA</TableHead>
              <TableHead>Creado por</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => {
              const aiCfg = aiStatusConfig[ticket.aiStatus] || aiStatusConfig.PENDING;
              return (
                <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50">
                  {isAgent && (
                    <TableCell>
                      <Checkbox
                        checked={selectedTickets.has(ticket.id)}
                        onCheckedChange={() => toggleTicketSelection(ticket.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link
                      href={`${basePath}/tickets/${ticket.id}`}
                      className="font-medium hover:underline"
                    >
                      {ticket.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ticket.category ? (categoryLabels[ticket.category] || ticket.category) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ticket.assignedTo?.name || "Sin asignar"}
                  </TableCell>
                  {isAgent && (
                    <TableCell>
                      <SlaIndicator ticket={ticket} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={aiCfg.variant} className="text-xs">
                      {aiCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ticket.createdBy?.name || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(ticket.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {meta.page} de {meta.totalPages} ({meta.total} tickets)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

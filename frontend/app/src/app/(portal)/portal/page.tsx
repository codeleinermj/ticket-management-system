"use client";

import { useState } from "react";
import Link from "next/link";
import { useTickets, useCreateTicket } from "@/hooks/use-tickets";
import { useFiltersStore } from "@/stores/filters";
import { StatusBadge } from "@/components/tickets/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketStatus } from "@/types";
import type { CreateTicketInput } from "@/types";
import { Plus, Search, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ApiRequestError } from "@/lib/api";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

const statusFilterOptions = [
  { value: "ALL", label: "Todos" },
  { value: TicketStatus.OPEN, label: "Abiertos" },
  { value: TicketStatus.IN_PROGRESS, label: "En progreso" },
  { value: TicketStatus.RESOLVED, label: "Resueltos" },
  { value: TicketStatus.CLOSED, label: "Cerrados" },
];

export default function PortalHomePage() {
  const { data, isLoading, isError } = useTickets();
  const { page, setPage, status, setStatus, search, setSearch } = useFiltersStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createTicket = useCreateTicket();

  const resetForm = () => {
    setTitle("");
    setDescription("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateTicketInput = { title, description };
    createTicket.mutate(payload, {
      onSuccess: () => {
        toast.success("Tu ticket fue creado. Te notificaremos cuando haya respuesta.");
        resetForm();
        setDialogOpen(false);
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiRequestError ? error.message : "Error al crear el ticket"
        );
      },
    });
  };

  const tickets = data?.data?.data || [];
  const meta = data?.data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mis Tickets</h2>
          <p className="text-muted-foreground">
            Crea y da seguimiento a tus solicitudes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg border font-medium bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 text-sm cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Ticket
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Ticket</DialogTitle>
                <DialogDescription>
                  Describe tu problema o solicitud. Nuestro equipo te respondera lo antes posible.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="portal-title">Titulo</Label>
                  <Input
                    id="portal-title"
                    placeholder="Resumen breve del problema"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="portal-desc">Descripcion</Label>
                  <Textarea
                    id="portal-desc"
                    placeholder="Describe el problema en detalle..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={5}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending ? "Creando..." : "Crear Ticket"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por titulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {statusFilterOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={
                (opt.value === "ALL" && !status) || status === opt.value
                  ? "default"
                  : "ghost"
              }
              size="sm"
              onClick={() => setStatus(opt.value === "ALL" ? undefined : (opt.value as TicketStatus))}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-12 text-center text-muted-foreground">
          Error al cargar los tickets
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">No hay tickets</p>
          <p className="text-sm">Crea un nuevo ticket para empezar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/portal/tickets/${ticket.id}`}
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-medium truncate">{ticket.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(ticket.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <StatusBadge status={ticket.status} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(ticket.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
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

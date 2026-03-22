"use client";

import Link from "next/link";
import { useTickets } from "@/hooks/use-tickets";
import { useFiltersStore } from "@/stores/filters";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { TicketTableSkeleton } from "./ticket-table-skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

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

export function TicketTable() {
  const { data, isLoading, isError } = useTickets();
  const { page, setPage } = useFiltersStore();

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

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titulo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Creado por</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
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
                  {ticket.createdBy?.name || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(ticket.createdAt)}
                </TableCell>
              </TableRow>
            ))}
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

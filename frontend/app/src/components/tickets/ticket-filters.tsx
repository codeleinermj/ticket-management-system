"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useFiltersStore } from "@/stores/filters";
import { useAuthStore } from "@/stores/auth";
import { useAgents } from "@/hooks/use-users";
import { AiStatus, TicketCategory, TicketPriority, TicketStatus, UserRole } from "@/types";
import { Search, X, ChevronDown, ChevronUp, Download } from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { toast } from "sonner";

export function TicketFilters() {
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === UserRole.AGENT || user?.role === UserRole.ADMIN;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exporting, setExporting] = useState(false);

  const {
    status, priority, category, search, assignedTo, unassigned,
    aiStatus, dateFrom, dateTo, sortBy, sortOrder,
    setStatus, setPriority, setCategory, setSearch,
    setAssignedTo, setUnassigned, setAiStatus,
    setDateFrom, setDateTo, setSortBy, setSortOrder,
    resetFilters,
  } = useFiltersStore();

  const { data: agentsData } = useAgents();
  const agents = agentsData?.data || [];

  const hasFilters = status || priority || category || search || assignedTo || unassigned ||
    aiStatus || dateFrom || dateTo;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.exportTickets({ status, priority, category, search, dateFrom, dateTo });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tickets.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportacion completada");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={status || "all"}
          onValueChange={(v) => setStatus(v === "all" ? undefined : (v as TicketStatus))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value={TicketStatus.OPEN}>Abierto</SelectItem>
            <SelectItem value={TicketStatus.IN_PROGRESS}>En Progreso</SelectItem>
            <SelectItem value={TicketStatus.PENDING_MANUAL_REVIEW}>Revision Manual</SelectItem>
            <SelectItem value={TicketStatus.RESOLVED}>Resuelto</SelectItem>
            <SelectItem value={TicketStatus.CLOSED}>Cerrado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={priority || "all"}
          onValueChange={(v) => setPriority(v === "all" ? undefined : (v as TicketPriority))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value={TicketPriority.LOW}>Baja</SelectItem>
            <SelectItem value={TicketPriority.MEDIUM}>Media</SelectItem>
            <SelectItem value={TicketPriority.HIGH}>Alta</SelectItem>
            <SelectItem value={TicketPriority.CRITICAL}>Critica</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={category || "all"}
          onValueChange={(v) => setCategory(v === "all" ? undefined : (v as TicketCategory))}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value={TicketCategory.BUG}>Bug</SelectItem>
            <SelectItem value={TicketCategory.FEATURE_REQUEST}>Feature Request</SelectItem>
            <SelectItem value={TicketCategory.SUPPORT}>Soporte</SelectItem>
            <SelectItem value={TicketCategory.BILLING}>Facturacion</SelectItem>
            <SelectItem value={TicketCategory.OTHER}>Otro</SelectItem>
          </SelectContent>
        </Select>

        {isAgent && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Filtros
            {showAdvanced ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
          </Button>
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="mr-1 h-4 w-4" />
            Limpiar
          </Button>
        )}

        {isAgent && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="mr-1 h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar CSV"}
          </Button>
        )}
      </div>

      {showAdvanced && isAgent && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Fecha desde</label>
            <Input
              type="date"
              value={dateFrom || ""}
              onChange={(e) => setDateFrom(e.target.value || undefined)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Fecha hasta</label>
            <Input
              type="date"
              value={dateTo || ""}
              onChange={(e) => setDateTo(e.target.value || undefined)}
              className="w-[150px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Agente</label>
            <Select
              value={unassigned ? "unassigned" : (assignedTo || "all")}
              onValueChange={(v) => {
                if (v === "unassigned") {
                  setUnassigned(true);
                } else if (v === "all") {
                  setAssignedTo(undefined);
                  setUnassigned(false);
                } else {
                  setAssignedTo(v || undefined);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Estado IA</label>
            <Select
              value={aiStatus || "all"}
              onValueChange={(v) => setAiStatus(v === "all" ? undefined : (v as AiStatus))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado IA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value={AiStatus.PENDING}>Pendiente</SelectItem>
                <SelectItem value={AiStatus.CLASSIFIED}>Clasificado</SelectItem>
                <SelectItem value={AiStatus.FAILED}>Fallido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ordenar por</label>
            <Select
              value={sortBy || "createdAt"}
              onValueChange={(v) => setSortBy(v || undefined)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Fecha</SelectItem>
                <SelectItem value="priority">Prioridad</SelectItem>
                <SelectItem value="confidence">Confianza IA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Orden</label>
            <Select
              value={sortOrder || "desc"}
              onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descendente</SelectItem>
                <SelectItem value="asc">Ascendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

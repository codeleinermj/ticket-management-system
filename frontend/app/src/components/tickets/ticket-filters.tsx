"use client";

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
import { TicketCategory, TicketPriority, TicketStatus } from "@/types";
import { Search, X } from "lucide-react";

export function TicketFilters() {
  const {
    status,
    priority,
    category,
    search,
    setStatus,
    setPriority,
    setCategory,
    setSearch,
    resetFilters,
  } = useFiltersStore();

  const hasFilters = status || priority || category || search;

  return (
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
          <SelectItem value={TicketStatus.PENDING_MANUAL_REVIEW}>
            Revision Manual
          </SelectItem>
          <SelectItem value={TicketStatus.RESOLVED}>Resuelto</SelectItem>
          <SelectItem value={TicketStatus.CLOSED}>Cerrado</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={priority || "all"}
        onValueChange={(v) =>
          setPriority(v === "all" ? undefined : (v as TicketPriority))
        }
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
        onValueChange={(v) =>
          setCategory(v === "all" ? undefined : (v as TicketCategory))
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value={TicketCategory.BUG}>Bug</SelectItem>
          <SelectItem value={TicketCategory.FEATURE_REQUEST}>
            Feature Request
          </SelectItem>
          <SelectItem value={TicketCategory.SUPPORT}>Soporte</SelectItem>
          <SelectItem value={TicketCategory.BILLING}>Facturacion</SelectItem>
          <SelectItem value={TicketCategory.OTHER}>Otro</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X className="mr-1 h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}

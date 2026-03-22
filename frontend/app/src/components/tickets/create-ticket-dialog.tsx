"use client";

import { useState } from "react";
import { useCreateTicket } from "@/hooks/use-tickets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketCategory, TicketPriority } from "@/types";
import type { CreateTicketInput } from "@/types";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ApiRequestError } from "@/lib/api";

export function CreateTicketDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const createTicket = useCreateTicket();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("");
    setCategory("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateTicketInput = { title, description };
    if (priority) payload.priority = priority as TicketPriority;
    if (category) payload.category = category as TicketCategory;

    createTicket.mutate(payload, {
      onSuccess: () => {
        toast.success("Ticket creado exitosamente");
        resetForm();
        setOpen(false);
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiRequestError
            ? error.message
            : "Error al crear el ticket"
        );
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border font-medium bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 text-sm cursor-pointer">
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Ticket
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Ticket</DialogTitle>
            <DialogDescription>
              Describe el problema o solicitud. La IA clasificara automaticamente
              el ticket si no seleccionas prioridad o categoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titulo</Label>
              <Input
                id="title"
                placeholder="Resumen breve del problema"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                placeholder="Describe el problema en detalle..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                maxLength={5000}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Automatico (IA)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TicketPriority.LOW}>Baja</SelectItem>
                    <SelectItem value={TicketPriority.MEDIUM}>Media</SelectItem>
                    <SelectItem value={TicketPriority.HIGH}>Alta</SelectItem>
                    <SelectItem value={TicketPriority.CRITICAL}>
                      Critica
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Automatico (IA)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TicketCategory.BUG}>Bug</SelectItem>
                    <SelectItem value={TicketCategory.FEATURE_REQUEST}>
                      Feature Request
                    </SelectItem>
                    <SelectItem value={TicketCategory.SUPPORT}>
                      Soporte
                    </SelectItem>
                    <SelectItem value={TicketCategory.BILLING}>
                      Facturacion
                    </SelectItem>
                    <SelectItem value={TicketCategory.OTHER}>Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Deja en blanco para clasificacion automatica por IA
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createTicket.isPending}>
              {createTicket.isPending ? "Creando..." : "Crear Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

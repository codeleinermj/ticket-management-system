"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Brain, Clock, Shield, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { SlaConfig } from "@/types";

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Critica",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

const PRIORITY_BADGE_VARIANTS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  LOW: "bg-gray-100 text-gray-800",
};

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} hora${h > 1 ? "s" : ""}`;
  }
  return `${minutes} min`;
}

function SlaRow({ config }: { config: SlaConfig }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(String(config.maxResponseMinutes));

  const updateSla = useMutation({
    mutationFn: () => api.updateSlaConfig(config.priority, Number(minutes)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-configs"] });
      setEditing(false);
      toast.success("SLA actualizado");
    },
  });

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{PRIORITY_LABELS[config.priority]}</span>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-20 h-7 text-sm"
            min={1}
          />
          <span className="text-xs text-muted-foreground">min</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateSla.mutate()}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge className={PRIORITY_BADGE_VARIANTS[config.priority]}>
            {formatMinutes(config.maxResponseMinutes)}
          </Badge>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const { data: slaData } = useQuery({
    queryKey: ["sla-configs"],
    queryFn: () => api.getSlaConfigs(),
  });

  const slaConfigs: SlaConfig[] = slaData?.data || [];
  const orderedPriorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const ordered = orderedPriorities
    .map((p) => slaConfigs.find((c) => c.priority === p))
    .filter(Boolean) as SlaConfig[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configuracion</h2>
        <p className="text-muted-foreground">
          Configuracion del sistema y parametros de IA
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Clasificador IA</CardTitle>
            </div>
            <CardDescription>
              Configuracion del proveedor de clasificacion automatica
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Proveedor activo</span>
              <Badge variant="secondary">Mock (Desarrollo)</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Umbral de confianza</span>
              <span className="text-sm font-medium">50%</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reintentos</span>
              <span className="text-sm font-medium">3 intentos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">SLA por Prioridad</CardTitle>
            </div>
            <CardDescription>
              Tiempos objetivo de respuesta segun prioridad (editables)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ordered.map((config, i) => (
              <div key={config.id}>
                <SlaRow config={config} />
                {i < ordered.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Categorias</CardTitle>
            </div>
            <CardDescription>
              Categorias disponibles para clasificacion de tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge>Bug</Badge>
              <Badge>Feature Request</Badge>
              <Badge>Soporte</Badge>
              <Badge>Facturacion</Badge>
              <Badge>Otro</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

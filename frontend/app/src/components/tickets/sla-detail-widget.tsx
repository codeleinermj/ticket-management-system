"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import type { Ticket, SlaConfig } from "@/types";

const SLA_DEFAULTS: Record<string, number> = {
  CRITICAL: 60,
  HIGH: 240,
  MEDIUM: 480,
  LOW: 1440,
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Critica",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  if (h > 0) return `${sign}${h}h ${m}m`;
  return `${sign}${m}m`;
}

export function SlaDetailWidget({ ticket }: { ticket: Ticket }) {
  const { data } = useQuery({
    queryKey: ["sla-configs"],
    queryFn: () => api.getSlaConfigs(),
    staleTime: 5 * 60 * 1000,
  });

  const [now, setNow] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const configs: SlaConfig[] = data?.data || [];
  const priority = ticket.priority;
  if (!priority) return null;

  const config = configs.find((c) => c.priority === priority);
  const slaMinutes = config?.maxResponseMinutes ?? SLA_DEFAULTS[priority] ?? null;
  if (slaMinutes == null) return null;

  const createdAt = new Date(ticket.createdAt).getTime();
  const deadline = createdAt + slaMinutes * 60 * 1000;
  const deadlineDate = new Date(deadline);
  const createdDate = new Date(ticket.createdAt);

  let statusLabel: string;
  let statusColor: string;
  let Icon: typeof Clock;
  let remainingMinutes: number;

  if (ticket.firstResponseAt) {
    const responseAt = new Date(ticket.firstResponseAt).getTime();
    if (responseAt <= deadline) {
      statusLabel = "Cumplido";
      statusColor = "text-green-600";
      Icon = CheckCircle;
      remainingMinutes = 0;
    } else {
      statusLabel = "Incumplido";
      statusColor = "text-red-600";
      Icon = AlertCircle;
      remainingMinutes = Math.floor((responseAt - deadline) / 60000) * -1;
    }
  } else if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
    return null;
  } else {
    remainingMinutes = Math.floor((deadline - now) / 60000);
    const warningThreshold = slaMinutes * 0.25;

    if (remainingMinutes < 0) {
      statusLabel = "BREACH";
      statusColor = "text-red-600";
      Icon = AlertCircle;
    } else if (remainingMinutes < warningThreshold) {
      statusLabel = "WARNING";
      statusColor = "text-yellow-600";
      Icon = AlertTriangle;
    } else {
      statusLabel = "En tiempo";
      statusColor = "text-green-600";
      Icon = Clock;
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${statusColor}`} />
          SLA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Prioridad</span>
          <span className="font-medium">{PRIORITY_LABELS[priority] || priority} ({formatMinutes(slaMinutes)})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Creado</span>
          <span>{createdDate.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Deadline</span>
          <span>{deadlineDate.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estado</span>
          <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        {!ticket.firstResponseAt && ticket.status !== "CLOSED" && ticket.status !== "RESOLVED" && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tiempo restante</span>
            <span className={`font-medium ${statusColor}`}>{formatMinutes(remainingMinutes!)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

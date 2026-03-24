"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { Ticket, SlaConfig, TicketPriority } from "@/types";

const SLA_DEFAULTS: Record<string, number> = {
  CRITICAL: 60,
  HIGH: 240,
  MEDIUM: 480,
  LOW: 1440,
};

function getSlaMinutes(slaConfigs: SlaConfig[], priority: TicketPriority | null): number | null {
  if (!priority) return null;
  const config = slaConfigs.find((c) => c.priority === priority);
  return config?.maxResponseMinutes ?? SLA_DEFAULTS[priority] ?? null;
}

type SlaStatus = "ON_TIME" | "WARNING" | "BREACHED" | "MET" | "NA";

function computeSla(
  ticket: Ticket,
  slaMinutes: number | null
): { status: SlaStatus; label: string } {
  if (slaMinutes == null || !ticket.priority) {
    return { status: "NA", label: "—" };
  }

  const createdAt = new Date(ticket.createdAt).getTime();
  const deadline = createdAt + slaMinutes * 60 * 1000;

  // If first response was given
  if (ticket.firstResponseAt) {
    const responseAt = new Date(ticket.firstResponseAt).getTime();
    if (responseAt <= deadline) {
      return { status: "MET", label: "Cumplido" };
    }
    return { status: "BREACHED", label: "Incumplido" };
  }

  // Ticket is closed/resolved without agent response
  if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
    return { status: "NA", label: "—" };
  }

  const now = Date.now();
  const remaining = deadline - now;
  const warningThreshold = slaMinutes * 60 * 1000 * 0.25;

  if (remaining < 0) {
    const mins = Math.abs(Math.floor(remaining / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return {
      status: "BREACHED",
      label: h > 0 ? `-${h}h ${m}m` : `-${m}m`,
    };
  }

  const mins = Math.floor(remaining / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;

  if (remaining < warningThreshold) {
    return { status: "WARNING", label: timeLabel };
  }

  return { status: "ON_TIME", label: timeLabel };
}

export function SlaIndicator({ ticket }: { ticket: Ticket }) {
  const { data } = useQuery({
    queryKey: ["sla-configs"],
    queryFn: () => api.getSlaConfigs(),
    staleTime: 5 * 60 * 1000,
  });

  const [, setTick] = useState(0);

  // Update every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const configs = data?.data || [];
  const slaMinutes = getSlaMinutes(configs, ticket.priority);
  const { status, label } = computeSla(ticket, slaMinutes);

  if (status === "NA") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const config: Record<SlaStatus, { icon: typeof Clock; className: string }> = {
    ON_TIME: { icon: Clock, className: "text-green-600" },
    WARNING: { icon: AlertTriangle, className: "text-yellow-600" },
    BREACHED: { icon: AlertCircle, className: "text-red-600" },
    MET: { icon: CheckCircle, className: "text-green-600" },
    NA: { icon: Clock, className: "text-muted-foreground" },
  };

  const { icon: Icon, className } = config[status];

  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

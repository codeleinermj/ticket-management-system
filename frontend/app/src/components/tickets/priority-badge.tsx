import { Badge } from "@/components/ui/badge";
import { TicketPriority } from "@/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Flame,
  Clock,
} from "lucide-react";

const priorityConfig: Record<
  TicketPriority,
  { label: string; className: string; icon: React.ElementType }
> = {
  [TicketPriority.LOW]: {
    label: "Baja",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: ArrowDown,
  },
  [TicketPriority.MEDIUM]: {
    label: "Media",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: ArrowUp,
  },
  [TicketPriority.HIGH]: {
    label: "Alta",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    icon: AlertTriangle,
  },
  [TicketPriority.CRITICAL]: {
    label: "Critica",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    icon: Flame,
  },
};

export function PriorityBadge({ priority }: { priority: TicketPriority | null }) {
  if (!priority) {
    return (
      <Badge variant="secondary" className={cn("gap-1 text-xs", "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400")}>
        <Clock className="h-3 w-3" />
        Pendiente
      </Badge>
    );
  }

  const config = priorityConfig[priority];
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={cn("gap-1 text-xs", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

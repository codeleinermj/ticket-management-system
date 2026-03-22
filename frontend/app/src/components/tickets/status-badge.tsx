import { Badge } from "@/components/ui/badge";
import { TicketStatus } from "@/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  [TicketStatus.OPEN]: {
    label: "Abierto",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  },
  [TicketStatus.IN_PROGRESS]: {
    label: "En Progreso",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  },
  [TicketStatus.PENDING_MANUAL_REVIEW]: {
    label: "Revision Manual",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  },
  [TicketStatus.RESOLVED]: {
    label: "Resuelto",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  },
  [TicketStatus.CLOSED]: {
    label: "Cerrado",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="secondary" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}

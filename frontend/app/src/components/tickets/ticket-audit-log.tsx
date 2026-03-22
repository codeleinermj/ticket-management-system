import type { AuditLog } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketAuditLog({ logs }: { logs: AuditLog[] }) {
  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sin historial de cambios
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-64">
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 rounded-md border p-3 text-sm"
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">{log.action}</p>
              {log.field && (
                <p className="text-muted-foreground">
                  <span className="font-medium">{log.field}:</span>{" "}
                  {log.oldValue && (
                    <span className="line-through text-destructive/70">
                      {log.oldValue}
                    </span>
                  )}{" "}
                  {log.newValue && (
                    <span className="text-green-600 dark:text-green-400">
                      {log.newValue}
                    </span>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatDateTime(log.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

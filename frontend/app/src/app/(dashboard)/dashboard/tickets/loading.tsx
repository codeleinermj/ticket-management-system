import { Skeleton } from "@/components/ui/skeleton";
import { TicketTableSkeleton } from "@/components/tickets/ticket-table-skeleton";

export default function TicketsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-[160px]" />
        <Skeleton className="h-9 w-[140px]" />
        <Skeleton className="h-9 w-[170px]" />
      </div>
      <TicketTableSkeleton />
    </div>
  );
}

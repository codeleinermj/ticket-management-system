import { TicketFilters } from "@/components/tickets/ticket-filters";
import { TicketTable } from "@/components/tickets/ticket-table";
import { CreateTicketDialog } from "@/components/tickets/create-ticket-dialog";

export default function AdminTicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tickets</h2>
          <p className="text-muted-foreground">
            Gestiona todos los tickets del sistema
          </p>
        </div>
        <CreateTicketDialog />
      </div>
      <TicketFilters />
      <TicketTable basePath="/admin" />
    </div>
  );
}

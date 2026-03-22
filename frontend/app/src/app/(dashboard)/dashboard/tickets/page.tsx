import type { Metadata } from "next";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { TicketTable } from "@/components/tickets/ticket-table";
import { CreateTicketDialog } from "@/components/tickets/create-ticket-dialog";

export const metadata: Metadata = {
  title: "Tickets",
};

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tickets</h2>
          <p className="text-muted-foreground">
            Gestiona y da seguimiento a todos los tickets
          </p>
        </div>
        <CreateTicketDialog />
      </div>
      <TicketFilters />
      <TicketTable />
    </div>
  );
}

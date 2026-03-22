"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket, disconnectSocket, onTicketEvent } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth";
import type { TicketEvent } from "@/types";
import { toast } from "sonner";

export function useSocketConnection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    connectSocket();

    const unsubscribe = onTicketEvent((event: TicketEvent) => {
      switch (event.event) {
        case "ticket.created":
        case "ticket.deleted":
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          break;
        case "ticket.updated":
        case "ticket.status_changed":
          queryClient.invalidateQueries({
            queryKey: ["tickets", event.ticketId],
          });
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          break;
        case "ticket.classified":
          queryClient.invalidateQueries({
            queryKey: ["tickets", event.ticketId],
          });
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          toast.success("La IA ha clasificado un ticket", {
            description: `Categoria: ${event.data.category}, Prioridad: ${event.data.priority}`,
          });
          break;
        case "ticket.ai_failed":
          queryClient.invalidateQueries({
            queryKey: ["tickets", event.ticketId],
          });
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          toast.error("Error en la clasificacion de IA", {
            description: "El ticket requiere revision manual",
          });
          break;
      }
    });

    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, [isAuthenticated, queryClient]);
}

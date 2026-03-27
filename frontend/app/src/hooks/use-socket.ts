"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket, disconnectSocket, onTicketEvent } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth";
import type { TicketEvent } from "@/types";
import { toast } from "sonner";

// Track which ticket the user is currently viewing (for conditional toasts)
let activeTicketId: string | null = null;

export function setActiveTicketId(ticketId: string | null) {
  activeTicketId = ticketId;
}

// Listeners for new comments on a specific ticket
type CommentListener = (event: TicketEvent) => void;
const commentListeners = new Map<string, Set<CommentListener>>();

export function onNewComment(ticketId: string, listener: CommentListener): () => void {
  if (!commentListeners.has(ticketId)) {
    commentListeners.set(ticketId, new Set());
  }
  commentListeners.get(ticketId)!.add(listener);
  return () => {
    commentListeners.get(ticketId)?.delete(listener);
    if (commentListeners.get(ticketId)?.size === 0) {
      commentListeners.delete(ticketId);
    }
  };
}

export function useSocketConnection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
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
          queryClient.invalidateQueries({ queryKey: ["comments", event.ticketId] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          break;
        case "ticket.classified":
          queryClient.invalidateQueries({
            queryKey: ["tickets", event.ticketId],
          });
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
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
        case "comment.created": {
          // Always refresh comments and notifications
          queryClient.invalidateQueries({ queryKey: ["comments", event.ticketId] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });

          // Notify local comment listeners (for auto-scroll in chat)
          const listeners = commentListeners.get(event.ticketId);
          if (listeners) {
            listeners.forEach((listener) => listener(event));
          }

          // Show toast only if user is NOT the author AND NOT viewing the ticket
          const isOwnComment = event.data.userId === userId;
          if (!isOwnComment && activeTicketId !== event.ticketId) {
            toast("Nuevo mensaje", {
              description: `${event.data.userName}: ${event.data.content}`,
            });
          }
          break;
        }
      }
    });

    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, [isAuthenticated, userId, queryClient]);
}

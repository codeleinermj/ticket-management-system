"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useFiltersStore } from "@/stores/filters";
import type {
  CreateTicketInput,
  Ticket,
  TicketFilters,
  UpdateTicketInput,
} from "@/types";

export function useTickets() {
  const status = useFiltersStore((s) => s.status);
  const priority = useFiltersStore((s) => s.priority);
  const category = useFiltersStore((s) => s.category);
  const search = useFiltersStore((s) => s.search);
  const page = useFiltersStore((s) => s.page);

  const filters: TicketFilters = { status, priority, category, search, page, limit: 20 };

  return useQuery({
    queryKey: ["tickets", status, priority, category, search, page],
    queryFn: () => api.getTickets(filters),
    staleTime: 30 * 1000,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ["tickets", id],
    queryFn: () => api.getTicket(id),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTicketInput) => api.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketInput }) =>
      api.updateTicket(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["tickets", id] });
      const previous = queryClient.getQueryData(["tickets", id]);

      queryClient.setQueryData(["tickets", id], (old: { data: Ticket } | undefined) => {
        if (!old) return old;
        return { ...old, data: { ...old.data, ...data } };
      });

      return { previous };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tickets", id], context.previous);
      }
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useAcceptAiClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => api.acceptAiClassification(ticketId),
    onSettled: (_data, _error, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useCorrectAiClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      corrections,
    }: {
      ticketId: string;
      corrections: { category?: string; priority?: string };
    }) => api.correctAiClassification(ticketId, corrections),
    onSettled: (_data, _error, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

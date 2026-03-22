"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useComments(ticketId: string) {
  return useQuery({
    queryKey: ["comments", ticketId],
    queryFn: () => api.getComments(ticketId),
    enabled: !!ticketId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, content }: { ticketId: string; content: string }) =>
      api.addComment(ticketId, content),
    onSettled: (_data, _error, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, commentId }: { ticketId: string; commentId: string }) =>
      api.deleteComment(ticketId, commentId),
    onSettled: (_data, _error, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
    },
  });
}

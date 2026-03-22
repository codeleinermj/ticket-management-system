"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });
}

export function useUsers(params: { page?: number; role?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ["users", params.page, params.role, params.search],
    queryFn: () => api.getUsers({ ...params, limit: 20 }),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateUserRole(userId, role),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.toggleUserActive(userId, isActive),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

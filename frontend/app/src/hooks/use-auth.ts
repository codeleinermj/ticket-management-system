"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiRequestError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { LoginInput, RegisterInput } from "@/types";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export function useUser() {
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await api.getMe();
      setUser(res.data);
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginInput) => api.login(data),
    onSuccess: (res) => {
      setUser(res.data.user);
      connectSocket();
      queryClient.invalidateQueries({ queryKey: ["user"] });
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      await api.register(data);
      // Auto-login after successful registration
      return api.login({ email: data.email, password: data.password });
    },
    onSuccess: (res) => {
      setUser(res.data.user);
      connectSocket();
      queryClient.invalidateQueries({ queryKey: ["user"] });
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      logout();
      disconnectSocket();
      queryClient.clear();
      router.push("/login");
    },
  });
}

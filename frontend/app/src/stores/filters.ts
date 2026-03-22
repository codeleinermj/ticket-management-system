"use client";

import { create } from "zustand";
import type { TicketCategory, TicketPriority, TicketStatus } from "@/types";

interface FiltersState {
  status: TicketStatus | undefined;
  priority: TicketPriority | undefined;
  category: TicketCategory | undefined;
  search: string;
  page: number;
  setStatus: (status: TicketStatus | undefined) => void;
  setPriority: (priority: TicketPriority | undefined) => void;
  setCategory: (category: TicketCategory | undefined) => void;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  status: undefined,
  priority: undefined,
  category: undefined,
  search: "",
  page: 1,
  setStatus: (status) => set({ status, page: 1 }),
  setPriority: (priority) => set({ priority, page: 1 }),
  setCategory: (category) => set({ category, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setPage: (page) => set({ page }),
  resetFilters: () =>
    set({
      status: undefined,
      priority: undefined,
      category: undefined,
      search: "",
      page: 1,
    }),
}));

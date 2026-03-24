"use client";

import { create } from "zustand";
import type { AiStatus, TicketCategory, TicketPriority, TicketStatus } from "@/types";

interface FiltersState {
  status: TicketStatus | undefined;
  priority: TicketPriority | undefined;
  category: TicketCategory | undefined;
  search: string;
  page: number;
  assignedTo: string | undefined;
  unassigned: boolean;
  aiStatus: AiStatus | undefined;
  confidenceMin: number | undefined;
  confidenceMax: number | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  sortBy: string | undefined;
  sortOrder: "asc" | "desc" | undefined;
  selectedTickets: Set<string>;
  setStatus: (status: TicketStatus | undefined) => void;
  setPriority: (priority: TicketPriority | undefined) => void;
  setCategory: (category: TicketCategory | undefined) => void;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  setAssignedTo: (assignedTo: string | undefined) => void;
  setUnassigned: (unassigned: boolean) => void;
  setAiStatus: (aiStatus: AiStatus | undefined) => void;
  setConfidenceMin: (min: number | undefined) => void;
  setConfidenceMax: (max: number | undefined) => void;
  setDateFrom: (date: string | undefined) => void;
  setDateTo: (date: string | undefined) => void;
  setSortBy: (sortBy: string | undefined) => void;
  setSortOrder: (sortOrder: "asc" | "desc" | undefined) => void;
  toggleTicketSelection: (id: string) => void;
  selectAllTickets: (ids: string[]) => void;
  clearSelectedTickets: () => void;
  resetFilters: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  status: undefined,
  priority: undefined,
  category: undefined,
  search: "",
  page: 1,
  assignedTo: undefined,
  unassigned: false,
  aiStatus: undefined,
  confidenceMin: undefined,
  confidenceMax: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  sortBy: undefined,
  sortOrder: undefined,
  selectedTickets: new Set<string>(),
  setStatus: (status) => set({ status, page: 1 }),
  setPriority: (priority) => set({ priority, page: 1 }),
  setCategory: (category) => set({ category, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setPage: (page) => set({ page }),
  setAssignedTo: (assignedTo) => set({ assignedTo, unassigned: false, page: 1 }),
  setUnassigned: (unassigned) => set({ unassigned, assignedTo: undefined, page: 1 }),
  setAiStatus: (aiStatus) => set({ aiStatus, page: 1 }),
  setConfidenceMin: (confidenceMin) => set({ confidenceMin, page: 1 }),
  setConfidenceMax: (confidenceMax) => set({ confidenceMax, page: 1 }),
  setDateFrom: (dateFrom) => set({ dateFrom, page: 1 }),
  setDateTo: (dateTo) => set({ dateTo, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  toggleTicketSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedTickets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedTickets: next };
    }),
  selectAllTickets: (ids) => set({ selectedTickets: new Set(ids) }),
  clearSelectedTickets: () => set({ selectedTickets: new Set() }),
  resetFilters: () =>
    set({
      status: undefined,
      priority: undefined,
      category: undefined,
      search: "",
      page: 1,
      assignedTo: undefined,
      unassigned: false,
      aiStatus: undefined,
      confidenceMin: undefined,
      confidenceMax: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    }),
}));

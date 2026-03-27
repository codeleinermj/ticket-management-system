import type {
  ApiResponse,
  Attachment,
  BulkActionInput,
  Comment,
  CreateTicketInput,
  LoginInput,
  Notification,
  PaginatedResponse,
  RegisterInput,
  SlaConfig,
  Ticket,
  TicketFilters,
  UpdateTicketInput,
  User,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      throw new ApiRequestError(
        error.error || `HTTP ${res.status}`,
        res.status,
        error.details
      );
    }

    return res.json();
  }

  // Auth
  async login(data: LoginInput) {
    return this.request<ApiResponse<{ user: User }>>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async register(data: RegisterInput) {
    return this.request<ApiResponse<{ user: User }>>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async refreshToken() {
    return this.request<ApiResponse<{ accessToken: string }>>(
      "/api/auth/refresh",
      { method: "POST" }
    );
  }

  async logout() {
    return this.request<ApiResponse<null>>("/api/auth/logout", {
      method: "POST",
    });
  }

  async getMe() {
    return this.request<ApiResponse<User>>("/api/auth/me");
  }

  // Tickets
  async getTickets(filters: TicketFilters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.category) params.set("category", filters.category);
    if (filters.search) params.set("search", filters.search);
    if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
    if (filters.unassigned) params.set("unassigned", "true");
    if (filters.aiStatus) params.set("aiStatus", filters.aiStatus);
    if (filters.confidenceMin != null) params.set("confidenceMin", String(filters.confidenceMin));
    if (filters.confidenceMax != null) params.set("confidenceMax", String(filters.confidenceMax));
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

    const query = params.toString();
    return this.request<ApiResponse<PaginatedResponse<Ticket>>>(
      `/api/tickets${query ? `?${query}` : ""}`
    );
  }

  async getTicket(id: string) {
    return this.request<ApiResponse<Ticket>>(`/api/tickets/${id}`);
  }

  async createTicket(data: CreateTicketInput) {
    return this.request<ApiResponse<Ticket>>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTicket(id: string, data: UpdateTicketInput) {
    return this.request<ApiResponse<Ticket>>(`/api/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTicket(id: string) {
    return this.request<ApiResponse<null>>(`/api/tickets/${id}`, {
      method: "DELETE",
    });
  }

  // AI Feedback
  async acceptAiClassification(ticketId: string) {
    return this.request<ApiResponse<{ message: string }>>(`/api/tickets/${ticketId}/ai/accept`, {
      method: "POST",
    });
  }

  async correctAiClassification(ticketId: string, corrections: {
    category?: string;
    priority?: string;
  }) {
    return this.request<ApiResponse<Ticket>>(`/api/tickets/${ticketId}/ai/correct`, {
      method: "POST",
      body: JSON.stringify(corrections),
    });
  }

  // Comments
  async getComments(ticketId: string) {
    return this.request<ApiResponse<Comment[]>>(`/api/tickets/${ticketId}/comments`);
  }

  async addComment(ticketId: string, content: string) {
    return this.request<ApiResponse<Comment>>(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  async deleteComment(ticketId: string, commentId: string) {
    return this.request<ApiResponse<null>>(`/api/tickets/${ticketId}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  // Users
  async getAgents() {
    return this.request<ApiResponse<{ id: string; name: string; email: string; role: string }[]>>("/api/users/agents");
  }

  async getUsers(params: { page?: number; limit?: number; role?: string; search?: string } = {}) {
    const p = new URLSearchParams();
    if (params.page) p.set("page", String(params.page));
    if (params.limit) p.set("limit", String(params.limit));
    if (params.role) p.set("role", params.role);
    if (params.search) p.set("search", params.search);
    const query = p.toString();
    return this.request<ApiResponse<PaginatedResponse<User>>>(`/api/users${query ? `?${query}` : ""}`);
  }

  async updateUserRole(userId: string, role: string) {
    return this.request<ApiResponse<User>>(`/api/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  async toggleUserActive(userId: string, isActive: boolean) {
    return this.request<ApiResponse<User>>(`/api/users/${userId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  }

  // Notifications
  async getNotifications(params: { limit?: number; unreadOnly?: boolean } = {}) {
    const p = new URLSearchParams();
    if (params.limit) p.set("limit", String(params.limit));
    if (params.unreadOnly) p.set("unreadOnly", "true");
    const query = p.toString();
    return this.request<ApiResponse<{ notifications: Notification[]; unreadCount: number }>>(`/api/notifications${query ? `?${query}` : ""}`);
  }

  async markNotificationRead(id: string) {
    return this.request<ApiResponse<null>>(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });
  }

  async markAllNotificationsRead() {
    return this.request<ApiResponse<null>>("/api/notifications/read-all", {
      method: "POST",
    });
  }

  // Profile
  async updateProfile(data: { name: string }) {
    return this.request<ApiResponse<User>>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<ApiResponse<{ message: string }>>("/api/auth/password", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Password recovery
  async forgotPassword(email: string) {
    return this.request<ApiResponse<{ message: string }>>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request<ApiResponse<{ message: string }>>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  }

  // Email verification
  async verifyEmail(token: string) {
    return this.request<ApiResponse<{ message: string }>>(`/api/auth/verify-email?token=${token}`);
  }

  async resendVerification() {
    return this.request<ApiResponse<{ message: string }>>("/api/auth/resend-verification", {
      method: "POST",
    });
  }

  // SLA
  async getSlaConfigs() {
    return this.request<ApiResponse<SlaConfig[]>>("/api/sla");
  }

  async updateSlaConfig(priority: string, maxResponseMinutes: number) {
    return this.request<ApiResponse<SlaConfig>>(`/api/sla/${priority}`, {
      method: "PATCH",
      body: JSON.stringify({ maxResponseMinutes }),
    });
  }

  // Attachments
  async getAttachments(ticketId: string) {
    return this.request<ApiResponse<Attachment[]>>(`/api/tickets/${ticketId}/attachments`);
  }

  async uploadAttachment(ticketId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${this.baseUrl}/api/tickets/${ticketId}/attachments`;
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new ApiRequestError(error.error || `HTTP ${res.status}`, res.status);
    }
    return res.json();
  }

  async downloadAttachment(id: string) {
    const url = `${this.baseUrl}/api/attachments/${id}/download`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new ApiRequestError("Download failed", res.status);
    return res;
  }

  async deleteAttachment(id: string) {
    return this.request<ApiResponse<null>>(`/api/attachments/${id}`, {
      method: "DELETE",
    });
  }

  // Export
  async exportTickets(filters: TicketFilters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.category) params.set("category", filters.category);
    if (filters.search) params.set("search", filters.search);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    const query = params.toString();
    const url = `${this.baseUrl}/api/tickets/export/csv${query ? `?${query}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Export failed" }));
      throw new ApiRequestError(error.error || `HTTP ${res.status}`, res.status);
    }
    return res;
  }

  // Bulk actions
  async bulkAction(data: BulkActionInput) {
    return this.request<ApiResponse<{ processed: number; failed: number; results: unknown[] }>>("/api/tickets/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export class ApiRequestError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(
    message: string,
    status: number,
    details?: { field: string; message: string }[]
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

export const api = new ApiClient(API_URL);

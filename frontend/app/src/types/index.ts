export enum TicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  PENDING_MANUAL_REVIEW = "PENDING_MANUAL_REVIEW",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum TicketCategory {
  BUG = "BUG",
  FEATURE_REQUEST = "FEATURE_REQUEST",
  SUPPORT = "SUPPORT",
  BILLING = "BILLING",
  OTHER = "OTHER",
}

export enum AiStatus {
  PENDING = "PENDING",
  CLASSIFIED = "CLASSIFIED",
  FAILED = "FAILED",
}

export enum UserRole {
  ADMIN = "ADMIN",
  AGENT = "AGENT",
  USER = "USER",
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AiResult {
  id: string;
  ticketId: string;
  provider: string;
  category: TicketCategory;
  priority: TicketPriority;
  suggestedResponse: string;
  confidence: number;
  accepted: boolean | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority | null;
  category: TicketCategory | null;
  aiResponse: string | null;
  aiStatus: AiStatus;
  confidence: number | null;
  createdBy: User;
  assignedTo: User | null;
  createdById: string;
  assignedToId: string | null;
  auditLogs?: AuditLog[];
  aiResults?: AiResult[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  ticketId: string;
  userId: string | null;
  user?: User;
  createdAt: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority?: TicketPriority;
  category?: TicketCategory;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: { field: string; message: string }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export interface Comment {
  id: string;
  content: string;
  ticketId: string;
  userId: string;
  user: { id: string; name: string; email: string; role: UserRole };
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  ticketId: string | null;
  userId: string;
  read: boolean;
  createdAt: string;
}

export interface TicketEvent {
  event: "ticket.created" | "ticket.updated" | "ticket.status_changed" | "ticket.deleted" | "ticket.classified" | "ticket.ai_failed";
  ticketId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

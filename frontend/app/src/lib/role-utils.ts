import { UserRole } from "@/types";

export function getRoleBasePath(role: UserRole): string {
  switch (role) {
    case UserRole.USER:
      return "/portal";
    case UserRole.AGENT:
      return "/dashboard";
    case UserRole.ADMIN:
      return "/admin";
    default:
      return "/portal";
  }
}

export function getRoleTicketPath(role: UserRole, ticketId?: string): string {
  const base = getRoleBasePath(role);
  if (role === UserRole.USER) {
    return ticketId ? `${base}/tickets/${ticketId}` : base;
  }
  return ticketId ? `${base}/tickets/${ticketId}` : `${base}/tickets`;
}

import { z } from "zod";

export const UserRole = z.enum(["ADMIN", "AGENT", "USER"]);

export const RegisterUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: UserRole.optional().default("USER"),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type UserRole = z.infer<typeof UserRole>;
export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128).regex(
    /^(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least 1 uppercase letter and 1 number"
  ),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128).regex(
    /^(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least 1 uppercase letter and 1 number"
  ),
});

export const BulkActionSchema = z.object({
  ticketIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(["update_status", "assign", "update_priority", "delete"]),
  data: z.object({
    status: z.string().optional(),
    assignedToId: z.string().uuid().optional(),
    priority: z.string().optional(),
  }).optional(),
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

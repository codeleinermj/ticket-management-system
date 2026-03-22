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
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

import { prisma } from "../lib/prisma";

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async findByIdWithToken(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true, refreshToken: true },
    });
  }

  async create(data: { email: string; password: string; name: string; role?: string }) {
    return prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: (data.role as any) || "USER",
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async updateRefreshToken(id: string, refreshToken: string | null) {
    return prisma.user.update({
      where: { id },
      data: { refreshToken },
    });
  }

  async findAll(params: { page: number; limit: number; role?: string; search?: string }) {
    const { page, limit, role, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAgents() {
    return prisma.user.findMany({
      where: { role: { in: ["AGENT", "ADMIN"] }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
  }

  async updateRole(id: string, role: string) {
    return prisma.user.update({
      where: { id },
      data: { role: role as any },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
  }

  async toggleActive(id: string, isActive: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
  }

  async updateName(id: string, name: string) {
    return prisma.user.update({
      where: { id },
      data: { name },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async findByIdWithPassword(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, password: true, createdAt: true },
    });
  }

  async updatePassword(id: string, hashedPassword: string) {
    return prisma.user.update({
      where: { id },
      data: { password: hashedPassword, refreshToken: null },
    });
  }

  async setVerificationToken(id: string, tokenHash: string, expires: Date) {
    return prisma.user.update({
      where: { id },
      data: { verificationToken: tokenHash, verificationExpires: expires },
    });
  }

  async verifyEmail(id: string) {
    return prisma.user.update({
      where: { id },
      data: { emailVerified: true, verificationToken: null, verificationExpires: null },
    });
  }

  async findByVerificationToken(tokenHash: string) {
    return prisma.user.findFirst({
      where: {
        verificationToken: tokenHash,
        verificationExpires: { gt: new Date() },
      },
      select: { id: true, email: true, name: true, role: true, emailVerified: true },
    });
  }

  async countActiveAdmins() {
    return prisma.user.count({ where: { role: "ADMIN", isActive: true } });
  }

  async findByIdFull(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        emailVerified: true, createdAt: true,
      },
    });
  }
}

export const userRepository = new UserRepository();

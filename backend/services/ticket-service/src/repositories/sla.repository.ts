import { prisma } from "../lib/prisma";

export class SlaRepository {
  async findAll() {
    return prisma.slaConfig.findMany({ orderBy: { maxResponseMinutes: "asc" } });
  }

  async upsert(priority: string, maxResponseMinutes: number) {
    return prisma.slaConfig.upsert({
      where: { priority: priority as any },
      create: { priority: priority as any, maxResponseMinutes },
      update: { maxResponseMinutes },
    });
  }

  async findByPriority(priority: string) {
    return prisma.slaConfig.findUnique({
      where: { priority: priority as any },
    });
  }

  async seed() {
    const defaults = [
      { priority: "CRITICAL", maxResponseMinutes: 60 },
      { priority: "HIGH", maxResponseMinutes: 240 },
      { priority: "MEDIUM", maxResponseMinutes: 480 },
      { priority: "LOW", maxResponseMinutes: 1440 },
    ];
    for (const d of defaults) {
      await this.upsert(d.priority, d.maxResponseMinutes);
    }
  }
}

export const slaRepository = new SlaRepository();

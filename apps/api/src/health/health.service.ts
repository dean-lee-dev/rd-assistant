import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatsSummary() {
    const userCount = await this.prisma.user.count();
    const aiRows = await this.prisma.aiSetting.findMany({
      select: { apiKey: true },
    });
    const aiConfigured = aiRows.some((r) => Boolean(r.apiKey?.trim()));
    const worktimeImportCount = await this.prisma.worktimeImport.count();
    const weeklyReportCount = await this.prisma.weeklyReport.count();
    const sysParamCount = await this.prisma.sysParam.count();
    return {
      userCount,
      aiConfigured,
      worktimeImportCount,
      weeklyReportCount,
      sysParamCount,
    };
  }
}

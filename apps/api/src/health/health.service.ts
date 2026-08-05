import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, AiSetting, WeeklyReport, WorktimeImport, SysParam } from '../entities';

@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AiSetting) private readonly aiSettings: Repository<AiSetting>,
    @InjectRepository(WeeklyReport) private readonly weeklyReports: Repository<WeeklyReport>,
    @InjectRepository(WorktimeImport) private readonly worktimeImports: Repository<WorktimeImport>,
    @InjectRepository(SysParam) private readonly sysParams: Repository<SysParam>,
    // private readonly jwt: JwtService,
  ) {}


  async getStatsSummary() {
    console.log('getStatsSummary');
    const userCount = await this.users.count();
    const aiConfigured = await this.aiSettings.findOne({ where: { apiKey: Not(IsNull()) } }) != null;
    const worktimeImportCount = await this.worktimeImports.count();
    const weeklyReportCount = await this.weeklyReports.count();
    const sysParamCount  = await this.sysParams.count();
    console.log(
        {
            userCount,
            aiConfigured,
            worktimeImportCount,
            weeklyReportCount,
            sysParamCount
          }
    )
    return {
      userCount,
      aiConfigured,
      worktimeImportCount,
      weeklyReportCount,
      sysParamCount
    };
  }

}
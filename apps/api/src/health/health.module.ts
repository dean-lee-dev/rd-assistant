import { Module } from '@nestjs/common';
/* import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSetting } from '../entities';
import { AiService } from '../ai/ai.service'; */
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { User, AiSetting, WeeklyReport, WorktimeImport, SysParam } from '../entities';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AiSetting, WeeklyReport, WorktimeImport, SysParam]),
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
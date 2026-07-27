import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyReport, WorktimeImport } from '../entities';
import { SettingsModule } from '../settings/settings.module';
import { WorktimeController } from './worktime.controller';
import { WorktimeService } from './worktime.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorktimeImport, WeeklyReport]),
    SettingsModule,
  ],
  controllers: [WorktimeController],
  providers: [WorktimeService],
})
export class WorktimeModule {}

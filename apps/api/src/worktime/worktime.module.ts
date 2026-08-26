import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { WorktimeController } from './worktime.controller';
import { WorktimeService } from './worktime.service';

@Module({
  imports: [SettingsModule],
  controllers: [WorktimeController],
  providers: [WorktimeService],
  exports: [WorktimeService],
})
export class WorktimeModule {}

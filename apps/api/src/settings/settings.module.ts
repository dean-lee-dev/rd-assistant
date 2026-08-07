import { Module } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [AiService],
  exports: [AiService],
})
export class SettingsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSetting } from '../entities';
import { AiService } from '../ai/ai.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiSetting])],
  controllers: [SettingsController],
  providers: [AiService],
  exports: [AiService],
})
export class SettingsModule {}

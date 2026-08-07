import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { SysParamsController } from './sys-params.controller';
import { SysParamsService } from './sys-params.service';

@Module({
  imports: [SettingsModule],
  controllers: [SysParamsController],
  providers: [SysParamsService],
})
export class SysParamsModule {}

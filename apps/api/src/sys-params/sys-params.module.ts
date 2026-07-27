import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysParam, SysParamAiState } from '../entities';
import { SettingsModule } from '../settings/settings.module';
import { SysParamsController } from './sys-params.controller';
import { SysParamsService } from './sys-params.service';

@Module({
  imports: [TypeOrmModule.forFeature([SysParam, SysParamAiState]), SettingsModule],
  controllers: [SysParamsController],
  providers: [SysParamsService],
})
export class SysParamsModule {}

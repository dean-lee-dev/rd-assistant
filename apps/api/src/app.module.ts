import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import {
  AiSetting,
  SysParam,
  SysParamAiState,
  User,
  WeeklyReport,
  WorktimeImport,
} from './entities';
import { ensureDataDirs, DB_FILE, UPLOADS_DIR } from './common/paths';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { WorktimeModule } from './worktime/worktime.module';
import { SysParamsModule } from './sys-params/sys-params.module';
import { SeedModule } from './seed/seed.module';
import { HealthModule } from './health/health.module';

ensureDataDirs();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: DB_FILE,
      autoSave: true,
      entities: [User, AiSetting, WorktimeImport, WeeklyReport, SysParam, SysParamAiState],
      synchronize: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: UPLOADS_DIR,
      serveRoot: '/uploads',
    }),
    AuthModule,
    SettingsModule,
    WorktimeModule,
    SysParamsModule,
    SeedModule,
    HealthModule,
  ],
})
export class AppModule {}

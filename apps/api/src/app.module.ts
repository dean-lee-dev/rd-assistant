import { Module } from '@nestjs/common';
import { ensureDataDirs } from './common/paths';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { WorktimeModule } from './worktime/worktime.module';
import { SysParamsModule } from './sys-params/sys-params.module';
import { SeedModule } from './seed/seed.module';
import { HealthModule } from './health/health.module';
import { NotesModule } from './notes/notes.module';

ensureDataDirs();

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SettingsModule,
    WorktimeModule,
    SysParamsModule,
    SeedModule,
    HealthModule,
    NotesModule,
  ],
})
export class AppModule {}

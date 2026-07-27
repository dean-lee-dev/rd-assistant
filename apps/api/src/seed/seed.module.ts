import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSetting, User } from '../entities';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AiSetting])],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}

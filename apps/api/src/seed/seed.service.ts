import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AiSetting, User } from '../entities';
import { DEFAULT_ADMIN_PASS, DEFAULT_ADMIN_USER } from '../common/paths';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AiSetting) private readonly aiSettings: Repository<AiSetting>,
  ) {}

  async onModuleInit() {
    const count = await this.users.count();
    if (count === 0) {
      const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASS, 10);
      await this.users.save(
        this.users.create({ username: DEFAULT_ADMIN_USER, passwordHash }),
      );
    }
    const aiCount = await this.aiSettings.count();
    if (aiCount === 0) {
      await this.aiSettings.save(
        this.aiSettings.create({
          provider: 'deepseek',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          apiKey: null,
        }),
      );
    }
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DEFAULT_ADMIN_PASS, DEFAULT_ADMIN_USER } from '../common/paths';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.user.count();
    if (count === 0) {
      const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASS, 10);
      await this.prisma.user.create({
        data: { username: DEFAULT_ADMIN_USER, passwordHash },
      });
    }
    const aiCount = await this.prisma.aiSetting.count();
    if (aiCount === 0) {
      await this.prisma.aiSetting.create({
        data: {
          provider: 'deepseek',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          apiKey: null,
        },
      });
    }
  }
}

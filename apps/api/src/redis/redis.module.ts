import { Module, Global, Inject } from "@nestjs/common";
import Redis from "ioredis";
import { Logger } from "@nestjs/common";

@Global()
@Module({
    providers: [
        {
            provide: 'REDIS_CLIENT',
            useFactory: () => new Redis(process.env.REDIS_URL as string || "redis://localhost:6379"),
        }
    ],
    exports: ["REDIS_CLIENT"],
})

export class RedisModule {
    constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

    async onModuleInit() {
        // 启动时：验证连接是否正常
        try {
            await this.redisClient.ping();
            Logger.log('✅ Redis 连接已就绪');
        } catch (error) {
            Logger.error('❌ Redis 连接失败', error);
            throw error;
        }
        
    }

    async onApplicationShutdown(signal?: string ) {
        await this.redisClient.quit();
        Logger.log('Redis client quit');
    }
}
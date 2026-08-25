import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class AiQuotaGuard implements CanActivate {

    constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        
        const user = context.switchToHttp().getRequest().user;
        if ( !user ) {
            throw new UnauthorizedException();
        }
        const userId = user.userId;

        const tick = await this.getTick(userId);
        if ( tick > 3 ) {
            throw new HttpException(
                "AI 调用次数已达上限",
                HttpStatus.TOO_MANY_REQUESTS
            );
        }
        return true;
    }

    private async getTick(userId: number): Promise<number> {
        const key = `ai-quota:${userId}`;
        return await this.redisClient.incr(key);
    }
}
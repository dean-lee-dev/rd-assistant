import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Observable } from "rxjs";


@Injectable()
export class AiQuotaGuard implements CanActivate {

    private tickMap = new Map<number, number>();

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        
        const user = context.switchToHttp().getRequest().user;
        if ( !user ) {
            throw new UnauthorizedException();
        }
        const userId = user.userId;
        const tick = this.tickMap.get(userId);
        if (tick) {
            if ( tick >= 3 ) {
                throw new HttpException(
                    "AI 调用次数已达上限",
                    HttpStatus.TOO_MANY_REQUESTS
                );
            }
            this.tickMap.set(userId, tick + 1);
        } else {
            this.tickMap.set(userId, 1);
        }
        Logger.log(user);
        return true;
    }
}
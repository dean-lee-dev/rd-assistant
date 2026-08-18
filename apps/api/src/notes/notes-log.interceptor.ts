import { CallHandler, ExecutionContext, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";

export class NotesLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(NotesLogInterceptor.name);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const now = Date.now();
        
        return next.handle().pipe(
            tap(() => {
                const request = context.switchToHttp().getRequest();
                const method = request.method;
                const url = request.url;
                const responseTime = Date.now() - now;
                const response = context.switchToHttp().getResponse();
                response.header("X-Response-Time", `${responseTime}ms`);
                this.logger.log(`${method}+${url}+${responseTime}ms`);
            })
        );
    }
}
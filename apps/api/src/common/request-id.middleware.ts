
import { NestMiddleware, Injectable, Logger } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from "node:crypto";

@Injectable()
export class RequestIdMiddleware implements  NestMiddleware {
    use(req: FastifyRequest, res: FastifyReply['raw'], next: ()=> void) {
        let rawRqId = req.headers['x-request-id'];
        if ( rawRqId && Array.isArray(rawRqId)) {
            rawRqId = rawRqId[0];
        }
        const requestId = rawRqId || randomUUID();
        (req as unknown as { requestId?: string }).requestId = requestId;
        res.setHeader('X-Request-Id', requestId);
       /*  Logger.log(`${req.method}+${req.originalUrl || req.url}+${requestId}`); */
        next();
    }
}

import { ArgumentsHost, Catch, ExceptionFilter, Injectable } from "@nestjs/common";
import type { FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';


@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
        const reply = host.switchToHttp().getResponse<FastifyReply>();
        const status = 404;
        if ( exception.code === "P2025" ) {
            void reply.status(status)
                .send({ statusCode: status, message: "记录不存在" });
            return;
        } else {
            void reply.status(500)
                .send({ statusCode: 500, message: "数据库操作失败" });
        }
    }
}
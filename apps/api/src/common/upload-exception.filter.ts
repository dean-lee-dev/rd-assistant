import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { MAX_EXCEL_UPLOAD_MB } from './upload';

function isFileTooLarge(exception: unknown): boolean {
  if (!exception || typeof exception !== 'object') return false;
  const e = exception as { code?: string; message?: string };
  if (e.code === 'FST_REQ_FILE_TOO_LARGE') return true;
  const msg = e.message || '';
  return /file.*(too large|size limit)|request file too large/i.test(msg);
}

/**
 * Fastify multipart 体积超限 → 400 中文提示；其它 HttpException 原样写出。
 */
@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    if (reply.sent) return;

    if (isFileTooLarge(exception)) {
      void reply.status(HttpStatus.BAD_REQUEST).send({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `文件超过 ${MAX_EXCEL_UPLOAD_MB}MB 上限，请拆分后再导入`,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      void reply
        .status(status)
        .send(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
    });
  }
}

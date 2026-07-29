import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { MAX_EXCEL_UPLOAD_MB } from './upload';

/**
 * 将 Multer 抛出的原生错误转成 400 与中文提示。
 * 默认情况下 `MulterError` 不是 HttpException，会被当成 500，前端只能看到「导入失败」。
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? `文件超过 ${MAX_EXCEL_UPLOAD_MB}MB 上限，请拆分后再导入`
        : `文件上传失败：${exception.message}`;
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
    });
  }
}

import { BadRequestException } from '@nestjs/common';
import '@fastify/multipart'; // 挂上 FastifyRequest.file 类型扩展
import type { FastifyRequest } from 'fastify';
import { decodeMulterFilename } from './filename';

/** Excel 上传大小上限：带内嵌图的参数表可达数十 MB。 */
export const MAX_EXCEL_UPLOAD_BYTES = 50 * 1024 * 1024;

/** 上限的 MB 表示，用于错误提示。 */
export const MAX_EXCEL_UPLOAD_MB = Math.round(MAX_EXCEL_UPLOAD_BYTES / 1024 / 1024);

/** 内存中的上传文件（Fastify multipart → buffer） */
export interface UploadedExcelFile {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size: number;
}

/**
 * 从 Fastify multipart 读取名为 `file` 的字段，校验 .xlsx 与大小。
 */
export async function readExcelUpload(req: FastifyRequest): Promise<UploadedExcelFile> {
  const data = await req.file();
  if (!data) {
    throw new BadRequestException('请上传 Excel 文件');
  }
  const originalname = decodeMulterFilename(data.filename || 'upload.xlsx');
  const lower = originalname.toLowerCase();
  if (!lower.endsWith('.xlsx')) {
    throw new BadRequestException('仅支持 .xlsx 文件');
  }
  const buffer = await data.toBuffer();
  if (!buffer.length) {
    throw new BadRequestException('请上传 Excel 文件');
  }
  if (buffer.length > MAX_EXCEL_UPLOAD_BYTES) {
    throw new BadRequestException(
      `文件超过 ${MAX_EXCEL_UPLOAD_MB}MB 上限，请拆分后再导入`,
    );
  }
  return {
    buffer,
    originalname,
    mimetype: data.mimetype,
    size: buffer.length,
  };
}

export async function readFileUpload(req: FastifyRequest, maxSize: number = 2*1024*1024): Promise<
  { buffer: Buffer, originalname: string, mimetype: string, size: number, extension: string }
> {
  const supportedExtensions = ['.jpg', '.jpeg', '.png', '.txt'];
  const data = await req.file();
  if ( !data ) {
    throw new BadRequestException('请上传文件');
  }
  
  const originalname = decodeMulterFilename(data.filename);
  const lower = originalname.toLowerCase();
  if (!supportedExtensions.some(ext => lower.endsWith(ext))) {
    throw new BadRequestException(`仅支持 ${supportedExtensions.join(',')} 文件`);
  }
  
  const buffer = await data.toBuffer();
  if (!buffer.length) {
    throw new BadRequestException('请上传文件');
  }
  if ( buffer.length > maxSize ) {
    throw new BadRequestException(`文件大小不能大于 ${Math.round(maxSize/1024/1024)} MB`);
  }
  return {
    buffer,
    originalname,
    mimetype: data.mimetype,
    size: buffer.length,
    extension: lower.split('.').pop() || '',
  };
}

import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { decodeMulterFilename } from './filename';

/** Excel 上传大小上限：带内嵌图的参数表可达数十 MB。 */
export const MAX_EXCEL_UPLOAD_BYTES = 50 * 1024 * 1024;

/** 上限的 MB 表示，用于错误提示。 */
export const MAX_EXCEL_UPLOAD_MB = Math.round(MAX_EXCEL_UPLOAD_BYTES / 1024 / 1024);

/**
 * Excel 上传的 Multer 配置：限制大小与扩展名。
 * 扩展名在 `decodeMulterFilename` 之后判断，避免中文名按 latin1 解读时误判。
 */
export const EXCEL_UPLOAD_OPTIONS: MulterOptions = {
  limits: { fileSize: MAX_EXCEL_UPLOAD_BYTES },
  fileFilter: (_req, file, callback) => {
    const name = decodeMulterFilename(file.originalname).toLowerCase();
    if (name.endsWith('.xlsx')) {
      callback(null, true);
      return;
    }
    callback(new BadRequestException('仅支持 .xlsx 文件'), false);
  },
};

import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { endSse, initSse, writeSse } from '../common/sse';
import { EXCEL_UPLOAD_OPTIONS } from '../common/upload';
import { SysParamsService } from './sys-params.service';

function sseErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof HttpException) {
    const r = e.getResponse();
    if (typeof r === 'string') return r;
    if (r && typeof r === 'object' && 'message' in r) {
      const m = (r as { message?: string | string[] }).message;
      if (Array.isArray(m)) return m.join('; ');
      if (typeof m === 'string') return m;
    }
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

@Controller('sys-params')
@UseGuards(AuthGuard('jwt'))
export class SysParamsController {
  constructor(private readonly sysParams: SysParamsService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file', EXCEL_UPLOAD_OPTIONS))
  import(@UploadedFile() file: Express.Multer.File) {
    return this.sysParams.importExcel(file);
  }

  @Get()
  list(@Query('q') q?: string, @Query('module') module?: string) {
    return this.sysParams.list(q, module);
  }

  @Get('ai-state')
  aiState() {
    return this.sysParams.getAiState();
  }

  @Post('analyze')
  analyze(@Body() body: { ids?: number[] }) {
    return this.sysParams.analyze(body?.ids);
  }

  @Post('analyze/stream')
  async analyzeStream(@Body() body: { ids?: number[] }, @Res() res: Response) {
    initSse(res);
    try {
      for await (const ev of this.sysParams.analyzeStream(body?.ids)) {
        writeSse(res, ev);
      }
      endSse(res);
    } catch (e) {
      writeSse(res, { type: 'error', message: sseErrorMessage(e, '分析失败') });
      endSse(res);
    }
  }

  @Post('chat')
  chat(@Body() body: { message?: string }) {
    return this.sysParams.chat(body?.message || '');
  }

  @Post('chat/stream')
  async chatStream(@Body() body: { message?: string }, @Res() res: Response) {
    initSse(res);
    try {
      for await (const ev of this.sysParams.chatStream(body?.message || '')) {
        writeSse(res, ev);
      }
      endSse(res);
    } catch (e) {
      writeSse(res, { type: 'error', message: sseErrorMessage(e, '对话失败') });
      endSse(res);
    }
  }

  @Post('chat/clear')
  clearChat() {
    return this.sysParams.clearChat();
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.sysParams.detail(id);
  }
}

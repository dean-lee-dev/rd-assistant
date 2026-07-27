import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WeeklyReportContent } from '../entities';
import { endSse, initSse, writeSse } from '../common/sse';
import { WorktimeService } from './worktime.service';

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

@Controller('worktime')
@UseGuards(AuthGuard('jwt'))
export class WorktimeController {
  constructor(private readonly worktime: WorktimeService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: Express.Multer.File) {
    return this.worktime.importExcel(file);
  }

  @Get('latest')
  latest() {
    return this.worktime.latest();
  }

  @Post('generate-report')
  generate(@Body() body: { importId?: number }) {
    return this.worktime.generateReport(body?.importId);
  }

  @Put('reports/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content: WeeklyReportContent },
  ) {
    return this.worktime.updateReport(id, body.content);
  }

  @Post('reports/:id/chat')
  chat(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { message: string },
  ) {
    return this.worktime.chat(id, body?.message);
  }

  @Post('reports/:id/chat/stream')
  async chatStream(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { message: string },
    @Res() res: Response,
  ) {
    initSse(res);
    try {
      for await (const ev of this.worktime.chatStream(id, body?.message || '')) {
        writeSse(res, ev);
      }
      endSse(res);
    } catch (e) {
      writeSse(res, { type: 'error', message: sseErrorMessage(e, '对话失败') });
      endSse(res);
    }
  }

  @Post('reports/:id/chat/clear')
  clearChat(@Param('id', ParseIntPipe) id: number) {
    return this.worktime.clearChat(id);
  }

  @Post('reports/:id/optimize')
  optimize(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { section: 'completed' | 'plan' },
  ) {
    return this.worktime.optimizeSection(id, body?.section);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { WeeklyReportContent } from '../types/domain';
import { endSse, initSse, writeSse } from '../common/sse';
import { readExcelUpload } from '../common/upload';
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
  async import(@Req() req: FastifyRequest) {
    const file = await readExcelUpload(req);
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
    @Res() reply: FastifyReply,
  ) {
    initSse(reply);
    try {
      for await (const ev of this.worktime.chatStream(id, body?.message || '')) {
        writeSse(reply, ev);
      }
      endSse(reply);
    } catch (e) {
      writeSse(reply, { type: 'error', message: sseErrorMessage(e, '对话失败') });
      endSse(reply);
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

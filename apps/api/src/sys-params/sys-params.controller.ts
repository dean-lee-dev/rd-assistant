import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { endSse, initSse, writeSse } from '../common/sse';
import { readExcelUpload } from '../common/upload';
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
  async import(@Req() req: FastifyRequest) {
    const file = await readExcelUpload(req);
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
  async analyzeStream(
    @Body() body: { ids?: number[] },
    @Res() reply: FastifyReply,
  ) {
    initSse(reply);
    try {
      for await (const ev of this.sysParams.analyzeStream(body?.ids)) {
        writeSse(reply, ev);
      }
      endSse(reply);
    } catch (e) {
      writeSse(reply, { type: 'error', message: sseErrorMessage(e, '分析失败') });
      endSse(reply);
    }
  }

  @Post('chat')
  chat(@Body() body: { message?: string }) {
    return this.sysParams.chat(body?.message || '');
  }

  @Post('chat/stream')
  async chatStream(
    @Body() body: { message?: string },
    @Res() reply: FastifyReply,
  ) {
    initSse(reply);
    try {
      for await (const ev of this.sysParams.chatStream(body?.message || '')) {
        writeSse(reply, ev);
      }
      endSse(reply);
    } catch (e) {
      writeSse(reply, { type: 'error', message: sseErrorMessage(e, '对话失败') });
      endSse(reply);
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

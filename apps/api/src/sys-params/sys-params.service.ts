import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { SysParamChatTurn } from '../types/domain';
import { AiService } from '../ai/ai.service';
import { UPLOADS_DIR } from '../common/paths';
import {
  SYS_PARAM_ALIASES,
  buildColumnMap,
  cellToString,
} from '../common/excel-map';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedExcelFile } from '../common/upload';

type SysParamRow = {
  id: number;
  excelRowNo: number;
  configName: string | null;
  configKey: string | null;
  module: string | null;
  comment: string | null;
  backendService: string | null;
  raw: Prisma.JsonValue;
  imagePaths: Prisma.JsonValue;
  createdAt: Date;
};

@Injectable()
export class SysParamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async importExcel(file: UploadedExcelFile) {
    if (!file?.buffer?.length) throw new BadRequestException('请上传 Excel 文件');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel 无工作表');

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = cellToString(cell.value);
    });
    const maxCol = Math.max(headers.length, sheet.actualColumnCount || 0);
    for (let i = 0; i < maxCol; i++) headers[i] = headers[i] || `列${i + 1}`;

    const colMap = buildColumnMap(headers, SYS_PARAM_ALIASES);
    const imageMap = extractImages(workbook, sheet);
    const dir = join(UPLOADS_DIR, 'sys-params', randomUUID());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const rows: Prisma.SysParamCreateManyInput[] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      // skip fully empty rows
      let empty = true;
      const raw: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        const val = cellToString(row.getCell(i + 1).value);
        raw[h] = val;
        if (val) empty = false;
      });
      if (empty && !imageMap.get(rowNumber)?.length) return;

      const imgs = imageMap.get(rowNumber) || [];
      const imagePaths: string[] = [];
      imgs.forEach((img, idx) => {
        const name = `r${rowNumber}_${idx}.${img.ext}`;
        const abs = join(dir, name);
        writeFileSync(abs, img.buffer);
        imagePaths.push(
          join('sys-params', dir.split(/[/\\]/).pop()!, name).replace(/\\/g, '/'),
        );
      });

      rows.push({
        excelRowNo: rowNumber,
        configName: strOrNull(pickField(raw, headers, colMap, 'configName')),
        configKey: strOrNull(pickField(raw, headers, colMap, 'configKey')),
        module: strOrNull(pickField(raw, headers, colMap, 'module')),
        comment: strOrNull(pickField(raw, headers, colMap, 'comment')),
        backendService: strOrNull(pickField(raw, headers, colMap, 'backendService')),
        raw: raw as Prisma.InputJsonValue,
        imagePaths: imagePaths as Prisma.InputJsonValue,
      });
    });

    // 事务内清表 + 批量写入；失败回滚后清理本次图片目录
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.sysParam.deleteMany();
        if (rows.length) {
          await tx.sysParam.createMany({ data: rows });
        }
      });
    } catch (e) {
      rmSync(dir, { recursive: true, force: true });
      throw e;
    }

    return {
      imported: rows.length,
      columnMap: Object.fromEntries(
        Object.entries(colMap).map(([k, v]) => [k, headers[v]]),
      ),
      headers,
    };
  }

  async list(q?: string, module?: string) {
    let items = await this.prisma.sysParam.findMany({
      orderBy: { excelRowNo: 'asc' },
    });
    if (module) {
      items = items.filter((i) => (i.module || '') === module);
    }
    if (q?.trim()) {
      const s = q.trim().toLowerCase();
      items = items.filter((i) => {
        const blob = JSON.stringify(i.raw || {}).toLowerCase();
        return (
          (i.configKey || '').toLowerCase().includes(s) ||
          (i.configName || '').toLowerCase().includes(s) ||
          (i.comment || '').toLowerCase().includes(s) ||
          (i.module || '').toLowerCase().includes(s) ||
          blob.includes(s)
        );
      });
    }
    return {
      total: items.length,
      items: items.map(summarize),
      modules: await this.moduleStats(),
    };
  }

  async detail(id: number) {
    try {
      const row = await this.prisma.sysParam.findUnique({ where: { id } });
      if (!row) throw new NotFoundException();
      let imageUrls: string[] = [];
      try {
        imageUrls = asStringArray(row.imagePaths)
          .filter((p) => !!p)
          .map((p) => `/uploads/${p}`);
      } catch {
        imageUrls = [];
      }
      let raw: Record<string, unknown> = {};
      try {
        raw =
          row.raw && typeof row.raw === 'object' && !Array.isArray(row.raw)
            ? { ...(row.raw as Record<string, unknown>) }
            : {};
      } catch {
        raw = { 原始字段: '解析失败' };
      }
      return {
        id: row.id,
        excelRowNo: row.excelRowNo,
        configName: row.configName,
        configKey: row.configKey,
        module: row.module,
        comment: row.comment,
        backendService: row.backendService,
        hasImage: Boolean(imageUrls.length),
        raw,
        imagePaths: row.imagePaths,
        imageUrls,
        createdAt: row.createdAt,
      };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw e;
    }
  }

  async moduleStats() {
    const all = await this.prisma.sysParam.findMany();
    const map = new Map<string, number>();
    for (const r of all) {
      const m = r.module || '(空模块)';
      map.set(m, (map.get(m) || 0) + 1);
    }
    return [...map.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getAiState() {
    const state = await this.ensureAiState();
    return {
      scope: state.scope,
      selectedIds: asNumberArray(state.selectedIds),
      analysisMarkdown: state.analysisMarkdown || '',
      chatMessages: asChatTurns(state.chatMessages),
      updatedAt: state.updatedAt,
    };
  }

  /**
   * ids 为空/未传 → 分析全部；否则分析选中行（含每行完整 raw）。
   */
  async analyze(ids?: number[]) {
    let full = '';
    let meta: { scope: string; selectedIds: number[]; count: number } | null = null;
    for await (const ev of this.analyzeStream(ids)) {
      if (ev.type === 'meta') meta = { scope: ev.scope, selectedIds: ev.selectedIds, count: ev.count };
      if (ev.type === 'delta') full += ev.content;
      if (ev.type === 'done') {
        return {
          markdown: ev.markdown,
          scope: meta?.scope || 'all',
          selectedIds: meta?.selectedIds || [],
          count: meta?.count || 0,
        };
      }
    }
    return {
      markdown: full,
      scope: meta?.scope || 'all',
      selectedIds: meta?.selectedIds || [],
      count: meta?.count || 0,
    };
  }

  async *analyzeStream(ids?: number[]): AsyncGenerator<
    | { type: 'meta'; scope: string; selectedIds: number[]; count: number }
    | { type: 'delta'; content: string }
    | { type: 'done'; markdown: string }
  > {
    const prepared = await this.prepareAnalyze(ids);
    yield {
      type: 'meta',
      scope: prepared.scope,
      selectedIds: prepared.selectedIds,
      count: prepared.count,
    };

    let markdown = '';
    for await (const chunk of this.ai.chatStream(prepared.messages, {
      temperature: 0.3,
      maxTokens: 4096,
    })) {
      markdown += chunk;
      yield { type: 'delta', content: chunk };
    }

    const state = await this.ensureAiState();
    await this.prisma.sysParamAiState.update({
      where: { id: state.id },
      data: {
        scope: prepared.scope,
        selectedIds:
          prepared.scope === 'selected'
            ? (prepared.selectedIds as Prisma.InputJsonValue)
            : ([] as Prisma.InputJsonValue),
        analysisMarkdown: markdown,
      },
    });
    yield { type: 'done', markdown };
  }

  async chat(message: string) {
    let reply = '';
    let chatMessages: SysParamChatTurn[] = [];
    for await (const ev of this.chatStream(message)) {
      if (ev.type === 'delta') reply += ev.content;
      if (ev.type === 'done') chatMessages = ev.chatMessages;
    }
    return { reply, chatMessages };
  }

  async *chatStream(message: string): AsyncGenerator<
    | { type: 'delta'; content: string }
    | { type: 'done'; chatMessages: SysParamChatTurn[] }
  > {
    const text = (message || '').trim();
    if (!text) throw new BadRequestException('请输入消息');

    const state = await this.ensureAiState();
    const history: SysParamChatTurn[] = [...asChatTurns(state.chatMessages)];
    const all = await this.prisma.sysParam.findMany({
      orderBy: { excelRowNo: 'asc' },
    });
    const selectedIds = asNumberArray(state.selectedIds);
    const contextRows =
      state.scope === 'selected' && selectedIds.length
        ? all.filter((r) => selectedIds.includes(r.id))
        : all;

    const system = [
      '你是个人研发效能助手中的配置洞察顾问（ai小助手）。',
      '请基于左侧分析结果与参数明细回答，支持多轮自由对话。',
      '回答用简洁中文 Markdown；不要编造参数表中不存在的配置。',
      '',
      '【分析范围】',
      state.scope === 'selected'
        ? `指定参数（${selectedIds.length} 条）`
        : `全部参数（${all.length} 条）`,
      '',
      '【最近一次 AI 分析】',
      state.analysisMarkdown || '（尚未生成分析）',
      '',
      '【参数明细摘要】',
      JSON.stringify(contextRows.slice(0, 80).map((r) => toFullRow(r))),
      contextRows.length > 80 ? `\n（共 ${contextRows.length} 条，摘要仅含前 80 条）` : '',
    ].join('\n');

    const messages = [
      { role: 'system' as const, content: system },
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: text },
    ];

    let reply = '';
    for await (const chunk of this.ai.chatStream(messages, {
      temperature: 0.4,
      maxTokens: 2048,
    })) {
      reply += chunk;
      yield { type: 'delta', content: chunk };
    }

    const now = new Date().toISOString();
    history.push({ role: 'user', content: text, at: now });
    history.push({ role: 'assistant', content: reply, at: now });
    const chatMessages = history.slice(-40);
    await this.prisma.sysParamAiState.update({
      where: { id: state.id },
      data: { chatMessages: chatMessages as unknown as Prisma.InputJsonValue },
    });
    yield { type: 'done', chatMessages };
  }

  async clearChat() {
    const state = await this.ensureAiState();
    await this.prisma.sysParamAiState.update({
      where: { id: state.id },
      data: { chatMessages: [] as Prisma.InputJsonValue },
    });
    return { chatMessages: [] };
  }

  private async prepareAnalyze(ids?: number[]) {
    const all = await this.prisma.sysParam.findMany({
      orderBy: { excelRowNo: 'asc' },
    });
    if (!all.length) throw new BadRequestException('暂无参数数据，请先上传 Excel');

    const selectedIds = Array.isArray(ids)
      ? [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))]
      : [];
    const scope = selectedIds.length ? 'selected' : 'all';
    const target =
      scope === 'selected' ? all.filter((r) => selectedIds.includes(r.id)) : all;

    if (!target.length) {
      throw new BadRequestException('未找到选中的参数，请重新勾选后再分析');
    }

    const payload = target.map((r) => toFullRow(r));
    const prompt =
      scope === 'selected'
        ? `请对以下「选中的系统配置参数」做深度分析。每条包含该行全部原始字段（raw），请综合整行信息，用中文输出 Markdown：
1. 逐条解读（配置用途、关键字段、潜在风险）
2. 选中项之间的关联 / 冲突 / 重复
3. 建议确认或清理的点
4. 其它观察

选中 ${target.length} 条，数据如下：
${JSON.stringify(payload)}`
        : `请对以下「全部系统配置参数」做整体分析。每条含该行全部原始字段（raw），用中文输出 Markdown：
1. 总体概况（条数、空 config_key/name 数量、重复 key、模块分布）
2. 按模块风险点与异常项
3. 建议清理或确认的项
4. 其它观察

共 ${target.length} 条，数据如下：
${JSON.stringify(payload)}`;

    return {
      scope,
      selectedIds,
      count: target.length,
      messages: [
        {
          role: 'system' as const,
          content:
            '你是配置治理顾问，基于完整参数行数据输出简洁可读的中文 Markdown，不要编造表中不存在的字段值。',
        },
        { role: 'user' as const, content: prompt },
      ],
    };
  }

  private async ensureAiState() {
    const existing = await this.prisma.sysParamAiState.findFirst({
      orderBy: { id: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.sysParamAiState.create({
      data: {
        scope: 'all',
        selectedIds: [] as Prisma.InputJsonValue,
        analysisMarkdown: '',
        chatMessages: [] as Prisma.InputJsonValue,
      },
    });
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];
}

function asChatTurns(value: unknown): SysParamChatTurn[] {
  return Array.isArray(value) ? (value as SysParamChatTurn[]) : [];
}

function toFullRow(r: SysParamRow) {
  return {
    id: r.id,
    excelRowNo: r.excelRowNo,
    configName: r.configName,
    configKey: r.configKey,
    module: r.module,
    comment: r.comment,
    backendService: r.backendService,
    hasImage: Boolean(asStringArray(r.imagePaths).length),
    raw: r.raw && typeof r.raw === 'object' && !Array.isArray(r.raw) ? r.raw : {},
  };
}

function summarize(r: SysParamRow) {
  return {
    id: r.id,
    excelRowNo: r.excelRowNo,
    configName: r.configName,
    configKey: r.configKey,
    module: r.module,
    comment: r.comment,
    backendService: r.backendService,
    hasImage: Boolean(asStringArray(r.imagePaths).length),
  };
}

function strOrNull(v: string) {
  const t = v.trim();
  return t ? t : null;
}

function pickField(
  raw: Record<string, unknown>,
  headers: string[],
  colMap: Record<string, number>,
  field: string,
): string {
  const idx = colMap[field];
  if (idx == null) return '';
  const h = headers[idx];
  return cellToString(raw[h]);
}

interface ExtractedImage {
  ext: string;
  buffer: Buffer;
}

function extractImages(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
): Map<number, ExtractedImage[]> {
  const map = new Map<number, ExtractedImage[]>();
  try {
    const images =
      (
        sheet as unknown as {
          getImages?: () => {
            imageId: string;
            range: { tl: { nativeRow: number; row?: number } };
          }[];
        }
      ).getImages?.() || [];
    for (const img of images) {
      const row = (img.range?.tl?.nativeRow ?? img.range?.tl?.row ?? 0) + 1;
      const media = workbook.model.media?.find(
        (m: { index?: number; type?: string }, i: number) =>
          String(i) === String(img.imageId) ||
          String((m as { index?: number }).index) === String(img.imageId),
      ) as { buffer?: Buffer; extension?: string; type?: string } | undefined;
      let buffer: Buffer | undefined;
      let ext = 'png';
      try {
        const got = workbook.getImage(Number(img.imageId));
        buffer = got?.buffer as Buffer | undefined;
        ext = (got as { extension?: string })?.extension || 'png';
      } catch {
        buffer = media?.buffer;
        ext = media?.extension || 'png';
      }
      if (!buffer) continue;
      const list = map.get(row) || [];
      list.push({ ext, buffer: Buffer.from(buffer) });
      map.set(row, list);
    }
  } catch {
    // 图片提取失败不阻断
  }
  return map;
}

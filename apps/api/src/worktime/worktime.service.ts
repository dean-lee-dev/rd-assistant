import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import type { WeeklyReportContent, WeeklyReportTaskItem } from '../types/domain';
import { AiService } from '../ai/ai.service';
import { decodeMulterFilename } from '../common/filename';
import {
  WORKTIME_ALIASES,
  buildColumnMap,
  cellToString,
  isDefectType,
  parseDescriptionDetails,
  stripLeadingNumber,
} from '../common/excel-map';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedExcelFile } from '../common/upload';

@Injectable()
export class WorktimeService {
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
    // fill sparse
    const maxCol = Math.max(headers.length, sheet.actualColumnCount || 0);
    for (let i = 0; i < maxCol; i++) headers[i] = headers[i] || '';

    const colMap = buildColumnMap(headers, WORKTIME_ALIASES);
    const records: Record<string, unknown>[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const raw: Record<string, unknown> = { excelRowNo: rowNumber };
      headers.forEach((h, i) => {
        if (!h) return;
        raw[h] = cellToString(row.getCell(i + 1).value);
      });
      const mapped: Record<string, unknown> = {
        excelRowNo: rowNumber,
        registrant: pick(row, colMap, 'registrant'),
        workDate: pick(row, colMap, 'workDate'),
        hours: pick(row, colMap, 'hours'),
        description: pick(row, colMap, 'description') || pick(row, colMap, 'remark'),
        remark: pick(row, colMap, 'remark'),
        projectCode: pick(row, colMap, 'projectCode'),
        taskId: normalizeTaskId(pick(row, colMap, 'taskId')),
        taskType: pick(row, colMap, 'taskType'),
        requirementName: pick(row, colMap, 'requirementName'),
        taskTitle: pick(row, colMap, 'taskTitle'),
        category1: pick(row, colMap, 'category1'),
        category2: pick(row, colMap, 'category2'),
        raw,
      };
      records.push(mapped);
    });

    const columnMap = Object.fromEntries(
      Object.entries(colMap).map(([k, v]) => [k, headers[v] || String(v)]),
    );

    const entity = await this.prisma.worktimeImport.create({
      data: {
        fileName: decodeMulterFilename(file.originalname),
        records: records as Prisma.InputJsonValue,
        columnMap: columnMap as Prisma.InputJsonValue,
        rowCount: records.length,
      },
    });

    return {
      id: entity.id,
      fileName: entity.fileName,
      rowCount: entity.rowCount,
      columnMap: entity.columnMap,
      warnings: buildWarnings(colMap),
      sample: records.slice(0, 5),
    };
  }

  async latest() {
    const imp = await this.prisma.worktimeImport.findFirst({
      orderBy: { id: 'desc' },
    });
    const rep = await this.prisma.weeklyReport.findFirst({
      orderBy: { id: 'desc' },
    });
    return {
      import: imp
        ? {
            id: imp.id,
            fileName: decodeMulterFilename(imp.fileName),
            rowCount: imp.rowCount,
            columnMap: imp.columnMap,
            createdAt: imp.createdAt,
          }
        : null,
      report: rep || null,
    };
  }

  async generateReport(importId?: number) {
    let imp = null as Awaited<ReturnType<typeof this.prisma.worktimeImport.findUnique>>;
    if (importId) {
      imp = await this.prisma.worktimeImport.findUnique({ where: { id: importId } });
    } else {
      imp = await this.prisma.worktimeImport.findFirst({ orderBy: { id: 'desc' } });
    }
    if (!imp) throw new NotFoundException('请先导入工时 Excel');

    const records = asRecordArray(imp.records);
    const ruleContent = aggregateByRules(records);
    let content = withHtml(ruleContent);
    let aiUsed = false;
    let aiError: string | null = null;

    try {
      const aiPart = await this.enrichWithAi(records, ruleContent);
      const merged: WeeklyReportContent = {
        ...ruleContent,
        completedTasks: aiPart.completedTasks ?? ruleContent.completedTasks,
        defects: aiPart.defects ?? ruleContent.defects,
        nextWeekPlan: aiPart.nextWeekPlan ?? ruleContent.nextWeekPlan,
        goalRate: '',
        summary: '',
        nextWeekIdeas: '',
        needsHelp: '',
        completedWorkHtml: '',
        completedWorkHtmlAi: '',
        nextWeekPlanHtml: '',
        nextWeekPlanHtmlAi: '',
      };
      content = withHtml(merged);
      // 规则/聚合生成的 HTML 视为「原始」；AI 润色版单独接口生成
      if (aiPart.completedWorkHtml) content.completedWorkHtml = String(aiPart.completedWorkHtml);
      if (aiPart.nextWeekPlanHtml) content.nextWeekPlanHtml = String(aiPart.nextWeekPlanHtml);
      content.completedWorkHtmlAi = '';
      content.nextWeekPlanHtmlAi = '';
      aiUsed = true;
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
      content = withHtml({
        ...ruleContent,
        goalRate: '',
        summary: '',
        nextWeekIdeas: '',
        needsHelp: '',
      });
    }

    return this.prisma.weeklyReport.create({
      data: {
        importId: imp.id,
        content: content as unknown as Prisma.InputJsonValue,
        aiUsed,
        aiError,
        chatMessages: [] as Prisma.InputJsonValue,
      },
    });
  }

  async updateReport(id: number, content: WeeklyReportContent) {
    const row = await this.prisma.weeklyReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('周报不存在');
    return this.prisma.weeklyReport.update({
      where: { id },
      data: { content: content as unknown as Prisma.InputJsonValue },
    });
  }

  async chat(reportId: number, message: string) {
    let reply = '';
    let chatMessages: { role: 'user' | 'assistant'; content: string; at?: string }[] = [];
    for await (const ev of this.chatStream(reportId, message)) {
      if (ev.type === 'delta') reply += ev.content;
      if (ev.type === 'done') chatMessages = ev.chatMessages;
    }
    return { reply, chatMessages };
  }

  async *chatStream(
    reportId: number,
    message: string,
  ): AsyncGenerator<
    | { type: 'delta'; content: string }
    | {
        type: 'done';
        chatMessages: { role: 'user' | 'assistant'; content: string; at?: string }[];
      }
  > {
    const text = (message || '').trim();
    if (!text) throw new BadRequestException('请输入消息');
    const report = await this.prisma.weeklyReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('周报不存在');

    let importRecords: Record<string, unknown>[] = [];
    if (report.importId) {
      const imp = await this.prisma.worktimeImport.findUnique({
        where: { id: report.importId },
      });
      importRecords = asRecordArray(imp?.records);
    }

    const content = asWeeklyContent(report.content);
    const history = asChatTurns(report.chatMessages);
    const system = [
      '你是个人研发效能助手中的周报分析顾问（ai小助手）。',
      '请基于用户本周周报汇总与工时明细回答问题，支持多轮沟通。',
      '回答用简洁中文 Markdown，必要时用条目列举；不要编造周报中不存在的任务号。',
      '',
      '【本周周报汇总】',
      contentToMarkdown(content),
      '',
      '【工时明细摘要】',
      JSON.stringify(
        importRecords.map((r) => ({
          taskId: r.taskId,
          taskName: r.taskName,
          taskType: r.taskType,
          remark: r.remark,
          workDate: r.workDate,
          hours: r.hours,
        })),
      ),
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
    await this.prisma.weeklyReport.update({
      where: { id: report.id },
      data: { chatMessages: chatMessages as unknown as Prisma.InputJsonValue },
    });
    yield { type: 'done', chatMessages };
  }

  async clearChat(reportId: number) {
    const report = await this.prisma.weeklyReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('周报不存在');
    await this.prisma.weeklyReport.update({
      where: { id: reportId },
      data: { chatMessages: [] as Prisma.InputJsonValue },
    });
    return { chatMessages: [] };
  }

  async optimizeSection(reportId: number, section: 'completed' | 'plan') {
    if (section !== 'completed' && section !== 'plan') {
      throw new BadRequestException('section 仅支持 completed 或 plan');
    }
    const report = await this.prisma.weeklyReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('周报不存在');

    const content = asWeeklyContent(report.content);
    const sourceHtml =
      section === 'completed'
        ? content.completedWorkHtml || ''
        : content.nextWeekPlanHtml || '';
    if (!sourceHtml.trim() || sourceHtml === '<p>无</p>') {
      throw new BadRequestException('请先生成原始周报内容');
    }

    const sectionName = section === 'completed' ? '本周完成工作' : '下周工作计划';
    const prompt = `请对以下「${sectionName}」HTML 内容做 AI 润色优化。
要求：
1. 保持 HTML 结构风格：任务标题用 <p><strong>...</strong></p>，明细用 <ol><li>...</li></ol>
2. 可去重、合并重复表述、润色措辞，使其更专业简洁
3. 不要编造不存在的任务号/需求；不要增加无关段落
4. 不要输出大标题「${sectionName}」
5. 只输出优化后的 HTML，不要 markdown 代码块，不要解释

原始 HTML：
${sourceHtml}`;

    let html = await this.ai.chat(
      [
        {
          role: 'system',
          content: '你是周报润色助手，只输出优化后的 HTML 片段。',
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.3, maxTokens: 4096 },
    );
    html = html
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    if (section === 'completed') {
      content.completedWorkHtmlAi = html;
    } else {
      content.nextWeekPlanHtmlAi = html;
    }
    const updated = await this.prisma.weeklyReport.update({
      where: { id: reportId },
      data: { content: content as unknown as Prisma.InputJsonValue },
    });
    return {
      section,
      html,
      content: asWeeklyContent(updated.content),
    };
  }

  private async enrichWithAi(
    records: Record<string, unknown>[],
    rule: WeeklyReportContent,
  ): Promise<Partial<WeeklyReportContent>> {
    const compact = records.map((r) => ({
      taskId: r.taskId,
      requirementName: r.requirementName,
      taskTitle: r.taskTitle,
      taskType: r.taskType,
      description: r.description,
      workDate: r.workDate,
      hours: r.hours,
    }));
    const prompt = `你是研发周报助手。根据工时明细，生成周报 JSON（不要 markdown 代码块）。
只输出字段：completedTasks、defects、nextWeekPlan。
规则：
1. 非缺陷：按任务标识聚合；title = "#任务标识 需求名称"；details = 描述拆成的短句列表
2. 缺陷类型（任务类型含缺陷）：不要拆成多条任务，放入 defects 一个元素：title="现场缺陷&开发缺陷"，details 每项为 "任务标识 任务名称 描述"
3. nextWeekPlan：基于本周非缺陷任务，details 写继续推进的建议（可空数组则由规则兜底）
4. 不要输出 goalRate/summary 等其它字段；不要编造任务标识

规则聚合参考:
${JSON.stringify(rule, null, 2)}

原始明细:
${JSON.stringify(compact)}`;

    const raw = await this.ai.chat([
      { role: 'system', content: '只输出合法 JSON 对象，不要其它文字。' },
      { role: 'user', content: prompt },
    ]);
    return parseJsonContent(raw);
  }
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function asWeeklyContent(value: unknown): WeeklyReportContent {
  return (value && typeof value === 'object' ? value : {}) as WeeklyReportContent;
}

function asChatTurns(
  value: unknown,
): { role: 'user' | 'assistant'; content: string; at?: string }[] {
  return Array.isArray(value)
    ? (value as { role: 'user' | 'assistant'; content: string; at?: string }[])
    : [];
}

function pick(
  row: ExcelJS.Row,
  colMap: Record<string, number>,
  field: string,
): string {
  const idx = colMap[field];
  if (idx == null) return '';
  return cellToString(row.getCell(idx + 1).value);
}

function normalizeTaskId(v: string): string {
  if (!v) return '';
  return v.replace(/^#/, '').trim();
}

function buildWarnings(colMap: Record<string, number>): string[] {
  const warnings: string[] = [];
  if (colMap.taskId == null) warnings.push('未识别到「任务标识」列');
  if (colMap.requirementName == null) warnings.push('未识别到「需求名称」列');
  if (colMap.description == null && colMap.remark == null) {
    warnings.push('未识别到「描述」列');
  }
  if (colMap.taskType == null) warnings.push('未识别到「任务类型」列，缺陷归类可能不准确');
  return warnings;
}

function aggregateByRules(records: Record<string, unknown>[]): WeeklyReportContent {
  const taskMap = new Map<string, WeeklyReportTaskItem>();
  const defectDetails: string[] = [];

  for (const r of records) {
    const taskId = normalizeTaskId(String(r.taskId || ''));
    const requirementName = String(r.requirementName || '').trim();
    const taskTitle = String(r.taskTitle || '').trim();
    const description = String(r.description || r.remark || '').trim();
    const defect = isDefectType(String(r.taskType || ''));

    if (defect) {
      const parts = parseDescriptionDetails(description);
      const lines = parts.length ? parts : [''];
      for (const part of lines) {
        const detail = [taskId, taskTitle || requirementName, part]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (detail && !defectDetails.includes(detail)) defectDetails.push(detail);
      }
      continue;
    }

    const key = taskId || requirementName || `row-${r.excelRowNo}`;
    const title =
      [taskId ? `#${taskId}` : '', requirementName].filter(Boolean).join(' ') ||
      `未命名任务`;
    let item = taskMap.get(key);
    if (!item) {
      item = { taskId, title, details: [], isDefect: false };
      taskMap.set(key, item);
    } else if (requirementName && !item.title.includes(requirementName)) {
      item.title = title;
    }
    for (const line of parseDescriptionDetails(description)) {
      if (!item.details.includes(line)) item.details.push(line);
    }
  }

  const completedTasks = [...taskMap.values()];
  const defects: WeeklyReportTaskItem[] = defectDetails.length
    ? [
        {
          taskId: '',
          title: '现场缺陷&开发缺陷',
          details: defectDetails,
          isDefect: true,
        },
      ]
    : [];

  const nextWeekPlan = completedTasks.map((t) => ({
    taskId: t.taskId,
    title: t.title,
    details: ['继续推进'],
    isDefect: false,
  }));

  return withHtml({
    completedTasks,
    defects,
    nextWeekPlan,
    completedWorkHtml: '',
    completedWorkHtmlAi: '',
    nextWeekPlanHtml: '',
    nextWeekPlanHtmlAi: '',
    goalRate: '',
    summary: '',
    nextWeekIdeas: '',
    needsHelp: '',
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tasksToHtml(tasks: WeeklyReportTaskItem[]): string {
  if (!tasks.length) return '<p>无</p>';
  return tasks
    .map((t) => {
      const head = `<p><strong>${escapeHtml(t.title || '')}</strong></p>`;
      const details = (t.details || [])
        .map((d) => stripLeadingNumber(d))
        .filter(Boolean)
        .map((d) => `<li>${escapeHtml(d)}</li>`)
        .join('');
      return details ? `${head}<ol>${details}</ol>` : head;
    })
    .join('');
}

function withHtml(content: WeeklyReportContent): WeeklyReportContent {
  const completedParts = [
    tasksToHtml(content.completedTasks || []),
    ...(content.defects || []).map((d) => tasksToHtml([d])),
  ];
  return {
    ...content,
    completedWorkHtml: completedParts.join('') || '<p>无</p>',
    completedWorkHtmlAi: content.completedWorkHtmlAi || '',
    nextWeekPlanHtml: tasksToHtml(content.nextWeekPlan || []),
    nextWeekPlanHtmlAi: content.nextWeekPlanHtmlAi || '',
  };
}

function parseJsonContent(raw: string): Partial<WeeklyReportContent> {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned) as Partial<WeeklyReportContent>;
}

export function contentToMarkdown(content: WeeklyReportContent): string {
  const fromHtml = (html: string) =>
    String(html || '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();

  return [
    '本周完成工作::',
    fromHtml(content.completedWorkHtml) || '- 无',
    '',
    '下周工作计划::',
    fromHtml(content.nextWeekPlanHtml) || '- 无',
  ].join('\n');
}

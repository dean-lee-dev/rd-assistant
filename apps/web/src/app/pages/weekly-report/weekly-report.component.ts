import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { API_BASE } from '../../core/api/api-base';
import { MdViewComponent } from '../../shared/md-view.component';
import { SseClient } from '../../shared/sse-client.service';

/** 周报区块内容视图模式：原始规则版 / AI 润色版 */
type ContentMode = 'original' | 'ai';

/**
 * 周报正文结构。
 * HTML 字段供富文本编辑；其余字段为规则/AI 聚合的结构化数据与摘要。
 */
interface ReportContent {
  /** 本周完成工作（原始 HTML） */
  completedWorkHtml: string;
  /** 本周完成工作（AI 润色 HTML） */
  completedWorkHtmlAi: string;
  /** 下周计划（原始 HTML） */
  nextWeekPlanHtml: string;
  /** 下周计划（AI 润色 HTML） */
  nextWeekPlanHtmlAi: string;
  /** 已完成任务列表（结构化，可选） */
  completedTasks?: unknown[];
  /** 缺陷列表（结构化，可选） */
  defects?: unknown[];
  /** 下周计划条目（结构化，可选） */
  nextWeekPlan?: unknown[];
  /** 目标完成率文案（可选） */
  goalRate?: string;
  /** 本周工作总结（可选） */
  summary?: string;
  /** 下周想法/补充（可选） */
  nextWeekIdeas?: string;
  /** 需协调/帮助事项（可选） */
  needsHelp?: string;
}

/** 右侧 AI 对话的一轮消息（用户或助手） */
interface ChatTurn {
  /** 发言角色 */
  role: 'user' | 'assistant';
  /** 消息正文（助手侧支持 Markdown） */
  content: string;
  /** 可选时间戳 */
  at?: string;
}

/** 服务端返回的周报实体 */
interface Report {
  /** 周报 ID */
  id: number;
  /** 周报内容 */
  content: ReportContent;
  /** 是否已使用过 AI */
  aiUsed: boolean;
  /** AI 失败时的错误信息，成功则为 null */
  aiError: string | null;
  /** 持久化的对话历史（可选） */
  chatMessages?: ChatTurn[] | null;
}

/**
 * 「最近一次」工时导入 + 周报的聚合响应。
 * 用于页面初始化回填。
 */
interface LatestResponse {
  /** 最近一次 Excel 导入摘要；无导入则为 null */
  import: { id: number; fileName: string; rowCount: number } | null;
  /** 关联周报；尚未生成则为 null */
  report: Report | null;
}

/**
 * 工时周报页 — Excel 导入、周报生成/编辑/导出、AI 润色、右侧流式对话。
 *
 * 左侧：上传工时 Excel → 按规则生成周报 → 分区块编辑（原始/AI 双视图）→ 复制/导出。
 * 右侧：基于当前周报的 AI 助手，SSE 流式输出，支持快捷提问与清空历史。
 */
@Component({
  selector: 'app-weekly-report',
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzRadioModule,
    NzTagModule,
    MdViewComponent,
  ],
  templateUrl: './weekly-report.component.html',
  styleUrl: './weekly-report.component.scss',
})
export class WeeklyReportComponent implements OnInit, AfterViewChecked {
  /** 右侧对话列表容器，用于自动滚到底部 */
  @ViewChild('chatList') chatListRef?: ElementRef<HTMLDivElement>;
  /** 本周完成工作富文本编辑区 */
  @ViewChild('completedBox') completedBox?: ElementRef<HTMLDivElement>;
  /** 下周计划富文本编辑区 */
  @ViewChild('planBox') planBox?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  private readonly sse = inject(SseClient);
  /** 富文本同步令牌：变更后强制重新写入 contenteditable */
  private htmlSyncKey = '';

  /** 当前工时导入记录 ID */
  importId: number | null = null;
  /** 导入文件名 */
  importName = '';
  /** 导入解析出的数据行数 */
  rowCount = 0;
  /** 当前周报；未生成时为 null */
  report: Report | null = null;
  /** 导入过程中的警告信息 */
  warnings: string[] = [];
  /** 是否正在上传 Excel */
  uploading = false;
  /** 是否正在生成周报 */
  generating = false;
  /** 是否正在保存周报 */
  saving = false;
  /** 是否正在对本周完成工作做 AI 润色 */
  optimizingCompleted = false;
  /** 是否正在对下周计划做 AI 润色 */
  optimizingPlan = false;
  /** 本周完成工作当前展示模式 */
  completedMode: ContentMode = 'original';
  /** 下周计划当前展示模式 */
  planMode: ContentMode = 'original';

  /** 右侧对话消息列表（本地 + 服务端同步） */
  chatMessages: ChatTurn[] = [];
  /** 对话输入框内容 */
  chatInput = '';
  /** 是否正在流式对话中 */
  chatting = false;
  /** 右侧快捷提问预设 */
  readonly quickQuestions = [
    '帮我润色本周完成工作表述',
    '根据本周工作完善下周计划',
    '总结本周风险与需协调事项',
  ];

  /** 初始化：拉取最近一次导入与周报 */
  ngOnInit(): void {
    this.loadLatest();
  }

  /** 视图检测后同步富文本编辑区 HTML */
  ngAfterViewChecked(): void {
    this.syncRichBoxes();
  }

  /** 按当前模式将 HTML 写入 contenteditable，避免重复同步 */
  private syncRichBoxes(): void {
    if (!this.report) return;
    const syncId = `${this.report.id}-${this.completedMode}-${this.planMode}-${this.htmlSyncKey}`;
    if (this._lastSyncId === syncId) return;
    if (this.completedBox?.nativeElement) {
      this.completedBox.nativeElement.innerHTML = this.getCompletedHtml();
    }
    if (this.planBox?.nativeElement) {
      this.planBox.nativeElement.innerHTML = this.getPlanHtml();
    }
    this._lastSyncId = syncId;
  }

  /** 按 completedMode 取本周完成工作 HTML */
  private getCompletedHtml(): string {
    if (!this.report) return '<p>无</p>';
    if (this.completedMode === 'ai') {
      return (
        this.report.content.completedWorkHtmlAi ||
        '<p class="muted-hint">尚未生成 AI 润色版，请点击「生成 AI 润色」</p>'
      );
    }
    return this.report.content.completedWorkHtml || '<p>无</p>';
  }

  /** 按 planMode 取下周计划 HTML */
  private getPlanHtml(): string {
    if (!this.report) return '<p>无</p>';
    if (this.planMode === 'ai') {
      return (
        this.report.content.nextWeekPlanHtmlAi ||
        '<p class="muted-hint">尚未生成 AI 润色版，请点击「生成 AI 润色」</p>'
      );
    }
    return this.report.content.nextWeekPlanHtml || '<p>无</p>';
  }

  /** 上次富文本同步的标识，用于去重 */
  private _lastSyncId = '';
  /** 标记富文本需要重新同步到 DOM */
  private markHtmlNeedsSync(): void {
    this.htmlSyncKey = String(Date.now());
    this._lastSyncId = '';
  }

  /**
   * 选择并上传工时 Excel。
   * 成功后更新 importId / 文件名 / 行数 / 警告。
   */
  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    this.uploading = true;
    this.http
      .post<{ id: number; fileName: string; rowCount: number; warnings: string[] }>(
        `${API_BASE}/worktime/import`,
        form,
      )
      .subscribe({
        next: (data) => {
          this.importId = data.id;
          this.importName = data.fileName;
          this.rowCount = data.rowCount;
          this.warnings = data.warnings || [];
          this.uploading = false;
          this.message.success('工时 Excel 导入成功');
        },
        error: (error) => this.fail(error, '导入失败', 'uploading'),
      });
  }

  /**
   * 基于当前导入记录生成周报（规则聚合原始版）。
   * 成功后重置为原始视图并清空/同步对话历史。
   */
  generate(): void {
    this.generating = true;
    this.http
      .post<Report>(`${API_BASE}/worktime/generate-report`, { importId: this.importId })
      .subscribe({
        next: (report) => {
          this.report = this.normalizeReport(report);
          this.chatMessages = report.chatMessages || [];
          this.completedMode = 'original';
          this.planMode = 'original';
          this.markHtmlNeedsSync();
          this.generating = false;
          this.message.success('周报已生成（原始版）');
        },
        error: (error) => this.fail(error, '生成失败', 'generating'),
      });
  }

  /**
   * 保存当前周报内容到服务端。
   * 保留本地对话列表，避免保存响应覆盖聊天状态。
   */
  save(): void {
    if (!this.report) return;
    this.saving = true;
    this.http
      .put<Report>(`${API_BASE}/worktime/reports/${this.report.id}`, {
        content: this.report.content,
      })
      .subscribe({
        next: (report) => {
          this.report = this.normalizeReport({
            ...report,
            chatMessages: this.chatMessages,
          });
          this.saving = false;
          this.message.success('已保存');
        },
        error: (error) => this.fail(error, '保存失败', 'saving'),
      });
  }

  /**
   * 本周完成工作编辑区 input：按当前模式写回原始或 AI HTML。
   */
  onCompletedInput(event: Event): void {
    if (!this.report) return;
    const html = (event.target as HTMLElement).innerHTML;
    if (this.completedMode === 'ai') {
      this.report.content.completedWorkHtmlAi = html;
    } else {
      this.report.content.completedWorkHtml = html;
    }
  }

  /**
   * 下周计划编辑区 input：按当前模式写回原始或 AI HTML。
   */
  onPlanInput(event: Event): void {
    if (!this.report) return;
    const html = (event.target as HTMLElement).innerHTML;
    if (this.planMode === 'ai') {
      this.report.content.nextWeekPlanHtmlAi = html;
    } else {
      this.report.content.nextWeekPlanHtml = html;
    }
  }

  /**
   * 切换本周完成工作的原始/AI 视图。
   * 切到 AI 且尚无润色内容时自动触发润色。
   */
  onCompletedModeChange(mode: ContentMode): void {
    this.completedMode = mode;
    this.markHtmlNeedsSync();
    if (mode === 'ai' && this.report && !this.report.content.completedWorkHtmlAi) {
      this.optimizeSection('completed');
    }
  }

  /**
   * 切换下周计划的原始/AI 视图。
   * 切到 AI 且尚无润色内容时自动触发润色。
   */
  onPlanModeChange(mode: ContentMode): void {
    this.planMode = mode;
    this.markHtmlNeedsSync();
    if (mode === 'ai' && this.report && !this.report.content.nextWeekPlanHtmlAi) {
      this.optimizeSection('plan');
    }
  }

  /**
   * 对指定区块调用服务端 AI 润色，并切换到 AI 视图。
   * @param section `completed` 本周完成工作；`plan` 下周计划
   */
  optimizeSection(section: 'completed' | 'plan'): void {
    if (!this.report) return;
    if (section === 'completed') this.optimizingCompleted = true;
    else this.optimizingPlan = true;
    this.http
      .post<{ html: string; content: ReportContent }>(
        `${API_BASE}/worktime/reports/${this.report.id}/optimize`,
        { section },
      )
      .subscribe({
        next: (data) => {
          if (!this.report) return;
          this.report.content = {
            ...this.report.content,
            ...data.content,
          };
          if (section === 'completed') {
            this.completedMode = 'ai';
            this.optimizingCompleted = false;
          } else {
            this.planMode = 'ai';
            this.optimizingPlan = false;
          }
          this.markHtmlNeedsSync();
          this.message.success(section === 'completed' ? '本周完成工作已 AI 润色' : '下周计划已 AI 润色');
        },
        error: (error: { error?: { message?: string } }) => {
          if (section === 'completed') this.optimizingCompleted = false;
          else this.optimizingPlan = false;
          this.message.error(error.error?.message || 'AI 润色失败');
        },
      });
  }

  /**
   * 发送右侧对话消息，经 SSE 流式追加助手回复。
   * 失败时回填输入框，并移除未完成的空助手消息。
   */
  sendChat(): void {
    if (!this.report || !this.chatInput.trim() || this.chatting) return;
    const message = this.chatInput.trim();
    this.chatInput = '';
    this.chatting = true;
    this.chatMessages = [
      ...this.chatMessages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ];
    this.scrollChat();

    const assistantIndex = this.chatMessages.length - 1;
    const reportId = this.report.id;
    this.sse
      .postSse(`${API_BASE}/worktime/reports/${reportId}/chat/stream`, { message })
      .subscribe({
        next: (ev) => {
          if (ev.type === 'delta' && ev.content) {
            const cur = this.chatMessages[assistantIndex];
            if (cur) {
              this.chatMessages[assistantIndex] = {
                ...cur,
                content: cur.content + ev.content,
              };
              this.chatMessages = [...this.chatMessages];
              this.scrollChat();
            }
          }
          if (ev.type === 'done' && ev.chatMessages) {
            this.chatMessages = ev.chatMessages as ChatTurn[];
          }
        },
        error: (error: Error) => {
          this.chatting = false;
          this.chatInput = message;
          if (
            this.chatMessages.length >= 2 &&
            this.chatMessages[this.chatMessages.length - 1]?.role === 'assistant' &&
            !this.chatMessages[this.chatMessages.length - 1]?.content
          ) {
            this.chatMessages = this.chatMessages.slice(0, -2);
          }
          this.message.error(error.message || '对话失败');
        },
        complete: () => {
          this.chatting = false;
          this.scrollChat();
        },
      });
  }

  /**
   * 点击快捷提问：填入输入框并立即发送。
   * @param q 预设问题文案
   */
  askQuick(q: string): void {
    this.chatInput = q;
    this.sendChat();
  }

  /**
   * 对话输入框回车发送；Shift+Enter 换行不发送。
   */
  onChatEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;
    e.preventDefault();
    this.sendChat();
  }

  /** 清空当前周报的服务端对话历史，并重置本地列表 */
  clearChat(): void {
    if (!this.report) return;
    this.http
      .post<{ chatMessages: ChatTurn[] }>(
        `${API_BASE}/worktime/reports/${this.report.id}/chat/clear`,
        {},
      )
      .subscribe({
        next: () => {
          this.chatMessages = [];
          this.message.success('对话已清空');
        },
        error: (error: { error?: { message?: string } }) =>
          this.message.error(error.error?.message || '清空失败'),
      });
  }

  /** 将当前两栏内容导出为纯文本 Markdown 并复制到剪贴板 */
  copyMarkdown(): void {
    void navigator.clipboard
      .writeText(this.toMarkdown())
      .then(() => this.message.success('Markdown 已复制'));
  }

  /** 将当前两栏内容以富文本（HTML + 纯文本）复制到剪贴板 */
  copyHtml(): void {
    this.copyAs(this.toCopyHtml(), this.toMarkdown(), '带格式内容已复制');
  }

  /**
   * 按区块与格式导出当前视图内容到剪贴板。
   * @param section 区块：`completed` / `plan`
   * @param format `md` 纯文本；`html` 富文本
   */
  exportSection(section: 'completed' | 'plan', format: 'md' | 'html'): void {
    if (!this.report) return;
    const label = section === 'completed' ? '本周完成工作' : '下周工作计划';
    const mode = section === 'completed' ? this.completedMode : this.planMode;
    const html =
      section === 'completed'
        ? mode === 'ai'
          ? this.report.content.completedWorkHtmlAi
          : this.report.content.completedWorkHtml
        : mode === 'ai'
          ? this.report.content.nextWeekPlanHtmlAi
          : this.report.content.nextWeekPlanHtml;
    if (mode === 'ai' && !html) {
      this.message.warning('当前为 AI 润色视图，但尚未生成内容');
      return;
    }
    const text = this.htmlToText(html || '');
    const modeLabel = mode === 'ai' ? 'AI润色' : '原始';
    if (format === 'md') {
      void navigator.clipboard
        .writeText(text || '')
        .then(() => this.message.success(`已导出：${label}（${modeLabel} Markdown）`));
      return;
    }
    this.copyAs(html || '', text || '', `已导出：${label}（${modeLabel} 富文本）`);
  }

  /** 优先以 ClipboardItem 写 HTML+纯文本，不支持时退化为纯文本 */
  private copyAs(html: string, plain: string, successMsg: string): void {
    if ('ClipboardItem' in window) {
      void navigator.clipboard
        .write([
          new ClipboardItem({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ])
        .then(() => this.message.success(successMsg));
    } else {
      void navigator.clipboard.writeText(plain).then(() => this.message.success(successMsg));
    }
  }

  /** 拉取最近一次导入与周报，用于页面回填 */
  private loadLatest(): void {
    this.http.get<LatestResponse>(`${API_BASE}/worktime/latest`).subscribe({
      next: (data) => {
        this.importId = data.import?.id ?? null;
        this.importName = data.import?.fileName ?? '';
        this.rowCount = data.import?.rowCount ?? 0;
        this.report = data.report ? this.normalizeReport(data.report) : null;
        this.chatMessages = data.report?.chatMessages || [];
        if (this.report) this.markHtmlNeedsSync();
      },
    });
  }

  /** 规范化周报 HTML 字段，补齐缺省占位 */
  private normalizeReport(report: Report): Report {
    const c = report.content || ({} as ReportContent);
    return {
      ...report,
      content: {
        ...c,
        completedWorkHtml: c.completedWorkHtml || '<p>无</p>',
        completedWorkHtmlAi: c.completedWorkHtmlAi || '',
        nextWeekPlanHtml: c.nextWeekPlanHtml || '<p>无</p>',
        nextWeekPlanHtmlAi: c.nextWeekPlanHtmlAi || '',
      },
    };
  }

  /** 将当前两栏 HTML 转为纯文本 Markdown 拼接 */
  private toMarkdown(): string {
    if (!this.report) return '';
    return [
      this.htmlToText(this.getCompletedHtml()),
      '',
      this.htmlToText(this.getPlanHtml()),
    ].join('\n');
  }

  /** 拼接当前两栏 HTML，供富文本复制 */
  private toCopyHtml(): string {
    if (!this.report) return '';
    return `${this.getCompletedHtml()}${this.getPlanHtml()}`;
  }

  /** 简易 HTML → 纯文本（段落/列表/换行与常见实体） */
  private htmlToText(html: string): string {
    return String(html || '')
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
  }

  /** 将对话列表滚动到底部 */
  private scrollChat(): void {
    setTimeout(() => {
      const el = this.chatListRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  /**
   * 统一处理上传/生成/保存失败：复位 loading 标志并提示错误。
   * @param error HTTP 错误对象
   * @param fallback 无服务端 message 时的兜底文案
   * @param flag 需复位的 loading 字段名
   */
  private fail(
    error: { error?: { message?: string } },
    fallback: string,
    flag: 'uploading' | 'generating' | 'saving',
  ): void {
    this[flag] = false;
    this.message.error(error.error?.message || fallback);
  }
}

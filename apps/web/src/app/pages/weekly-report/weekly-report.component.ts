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
import { AuthService } from '../../core/auth/auth.service';
import { MdViewComponent } from '../../shared/md-view.component';
import { postSse } from '../../shared/sse-client';

type ContentMode = 'original' | 'ai';

interface ReportContent {
  completedWorkHtml: string;
  completedWorkHtmlAi: string;
  nextWeekPlanHtml: string;
  nextWeekPlanHtmlAi: string;
  completedTasks?: unknown[];
  defects?: unknown[];
  nextWeekPlan?: unknown[];
  goalRate?: string;
  summary?: string;
  nextWeekIdeas?: string;
  needsHelp?: string;
}
interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  at?: string;
}
interface Report {
  id: number;
  content: ReportContent;
  aiUsed: boolean;
  aiError: string | null;
  chatMessages?: ChatTurn[] | null;
}
interface LatestResponse {
  import: { id: number; fileName: string; rowCount: number } | null;
  report: Report | null;
}

@Component({
  selector: 'app-weekly-report',
  standalone: true,
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
  template: `
    <nz-card nzTitle="工时周报" [nzExtra]="actions">
      <ng-template #actions>
        <input #fileInput type="file" accept=".xlsx,.xls" hidden (change)="onFileChange($event)" />
        <button nz-button (click)="fileInput.click()" [nzLoading]="uploading">上传 Excel</button>
        <button
          nz-button
          nzType="primary"
          (click)="generate()"
          [nzLoading]="generating"
          [disabled]="!importId"
        >
          生成周报
        </button>
      </ng-template>
      @if (importName) {
        <p>最近导入：<strong>{{ importName }}</strong>，共 {{ rowCount }} 条记录。</p>
      } @else {
        <p class="muted">请先上传工时 Excel。</p>
      }
      @for (warning of warnings; track warning) {
        <nz-alert nzType="warning" nzShowIcon [nzMessage]="warning" class="notice"></nz-alert>
      }
      @if (report?.aiError) {
        <nz-alert
          nzType="warning"
          nzShowIcon
          [nzMessage]="'AI 未完成：' + report?.aiError + '（已使用规则汇总）'"
          class="notice"
        ></nz-alert>
      }
    </nz-card>

    @if (report) {
      <div class="split">
        <nz-card class="left" nzTitle="周报汇总" [nzExtra]="copyActions">
          <ng-template #copyActions>
            <button nz-button (click)="exportSection('completed', 'md')">导出本周 Markdown</button>
            <button nz-button (click)="exportSection('completed', 'html')">导出本周富文本</button>
            <button nz-button (click)="exportSection('plan', 'md')">导出下周 Markdown</button>
            <button nz-button nzType="primary" (click)="exportSection('plan', 'html')">导出下周富文本</button>
            <button nz-button (click)="save()" [nzLoading]="saving">保存</button>
          </ng-template>

          <div class="section">
            <div class="section-head">
              <div class="section-title">本周完成工作</div>
              <div class="mode-row">
                <nz-radio-group
                  [(ngModel)]="completedMode"
                  (ngModelChange)="onCompletedModeChange($event)"
                  nzButtonStyle="solid"
                  nzSize="small"
                >
                  <label nz-radio-button nzValue="original">原始</label>
                  <label nz-radio-button nzValue="ai">AI 润色</label>
                </nz-radio-group>
                <button
                  nz-button
                  nzSize="small"
                  (click)="optimizeSection('completed')"
                  [nzLoading]="optimizingCompleted"
                >
                  {{ report.content.completedWorkHtmlAi ? '重新 AI 润色' : '生成 AI 润色' }}
                </button>
              </div>
            </div>
            <div
              #completedBox
              class="rich-box"
              contenteditable="true"
              (input)="onCompletedInput($event)"
            ></div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="section-title">下周工作计划</div>
              <div class="mode-row">
                <nz-radio-group
                  [(ngModel)]="planMode"
                  (ngModelChange)="onPlanModeChange($event)"
                  nzButtonStyle="solid"
                  nzSize="small"
                >
                  <label nz-radio-button nzValue="original">原始</label>
                  <label nz-radio-button nzValue="ai">AI 润色</label>
                </nz-radio-group>
                <button
                  nz-button
                  nzSize="small"
                  (click)="optimizeSection('plan')"
                  [nzLoading]="optimizingPlan"
                >
                  {{ report.content.nextWeekPlanHtmlAi ? '重新 AI 润色' : '生成 AI 润色' }}
                </button>
              </div>
            </div>
            <div
              #planBox
              class="rich-box"
              contenteditable="true"
              (input)="onPlanInput($event)"
            ></div>
          </div>
        </nz-card>

        <nz-card class="right" nzTitle="ai小助手对话" [nzExtra]="chatExtra">
          <ng-template #chatExtra>
            <button nz-button nzSize="small" (click)="clearChat()" [disabled]="!chatMessages.length">
              清空对话
            </button>
          </ng-template>
          <p class="muted chat-hint">可基于左侧周报继续追问、润色或讨论本周工作。</p>
          <div class="chat-quick">
            @for (q of quickQuestions; track q) {
              <nz-tag class="quick" (click)="askQuick(q)">{{ q }}</nz-tag>
            }
          </div>
          <div class="chat-list" #chatList>
            @if (!chatMessages.length && !chatting) {
              <div class="muted empty-chat">暂无对话，在下方输入后开始沟通。</div>
            }
            @for (msg of chatMessages; track $index) {
              <div
                class="bubble"
                [class.user]="msg.role === 'user'"
                [class.assistant]="msg.role === 'assistant'"
              >
                <div class="role">{{ msg.role === 'user' ? '我' : 'ai小助手' }}</div>
                @if (msg.role === 'assistant') {
                  <div class="content md">
                    <app-md-view
                      [content]="msg.content"
                      [streaming]="chatting && $index === chatMessages.length - 1"
                    ></app-md-view>
                  </div>
                } @else {
                  <div class="content pre">{{ msg.content }}</div>
                }
              </div>
            }
          </div>
          <div class="chat-input">
            <textarea
              nz-input
              rows="3"
              [(ngModel)]="chatInput"
              placeholder="就本周工作继续提问…"
              (keydown.enter)="onChatEnter($event)"
            ></textarea>
            <button
              nz-button
              nzType="primary"
              (click)="sendChat()"
              [nzLoading]="chatting"
              [disabled]="!chatInput.trim()"
            >
              发送
            </button>
          </div>
        </nz-card>
      </div>
    }
  `,
  styles: [
    `
      .notice {
        margin-top: 10px;
      }
      .muted {
        color: #8c8c8c;
      }
      .split {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
        align-items: start;
      }
      .left,
      .right {
        min-width: 0;
      }
      .section {
        margin-bottom: 16px;
      }
      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .section-title {
        font-weight: 600;
        font-size: 15px;
        margin: 0;
      }
      .mode-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .rich-box {
        min-height: 180px;
        max-height: 420px;
        overflow: auto;
        padding: 12px 14px;
        border: 1px solid #d9d9d9;
        border-radius: 8px;
        background: #fff;
        line-height: 1.6;
        outline: none;
      }
      .rich-box:focus {
        border-color: #1677ff;
        box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
      }
      .rich-box p {
        margin: 0 0 8px;
      }
      .rich-box ol,
      .rich-box ul {
        margin: 0 0 12px;
        padding-left: 22px;
      }
      .rich-box .muted-hint {
        color: #8c8c8c;
      }
      .chat-hint {
        margin-bottom: 10px;
      }
      .chat-quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .quick {
        cursor: pointer;
      }
      .chat-list {
        height: 420px;
        overflow: auto;
        padding: 12px;
        background: #fafafa;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        margin-bottom: 12px;
      }
      .empty-chat {
        text-align: center;
        padding: 40px 0;
      }
      .bubble {
        margin-bottom: 12px;
        max-width: 92%;
      }
      .bubble.user {
        margin-left: auto;
      }
      .bubble .role {
        font-size: 12px;
        color: #8c8c8c;
        margin-bottom: 4px;
      }
      .bubble .content {
        padding: 10px 12px;
        border-radius: 10px;
        background: #fff;
        border: 1px solid #f0f0f0;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      .bubble .content.md {
        background: #fff;
      }
      .bubble.user .content {
        background: #e6f4ff;
        border-color: #91caff;
      }
      .pre {
        white-space: pre-wrap;
      }
      .chat-input {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: end;
      }
      @media (max-width: 1100px) {
        .split {
          grid-template-columns: 1fr;
        }
        .chat-list {
          height: 320px;
        }
      }
    `,
  ],
})
export class WeeklyReportComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatList') chatListRef?: ElementRef<HTMLDivElement>;
  @ViewChild('completedBox') completedBox?: ElementRef<HTMLDivElement>;
  @ViewChild('planBox') planBox?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  private htmlSyncKey = '';

  importId: number | null = null;
  importName = '';
  rowCount = 0;
  report: Report | null = null;
  warnings: string[] = [];
  uploading = false;
  generating = false;
  saving = false;
  optimizingCompleted = false;
  optimizingPlan = false;
  completedMode: ContentMode = 'original';
  planMode: ContentMode = 'original';

  chatMessages: ChatTurn[] = [];
  chatInput = '';
  chatting = false;
  readonly quickQuestions = [
    '帮我润色本周完成工作表述',
    '根据本周工作完善下周计划',
    '总结本周风险与需协调事项',
  ];

  ngOnInit(): void {
    this.loadLatest();
  }

  ngAfterViewChecked(): void {
    this.syncRichBoxes();
  }

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

  private _lastSyncId = '';
  private markHtmlNeedsSync(): void {
    this.htmlSyncKey = String(Date.now());
    this._lastSyncId = '';
  }

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

  onCompletedInput(event: Event): void {
    if (!this.report) return;
    const html = (event.target as HTMLElement).innerHTML;
    if (this.completedMode === 'ai') {
      this.report.content.completedWorkHtmlAi = html;
    } else {
      this.report.content.completedWorkHtml = html;
    }
  }

  onPlanInput(event: Event): void {
    if (!this.report) return;
    const html = (event.target as HTMLElement).innerHTML;
    if (this.planMode === 'ai') {
      this.report.content.nextWeekPlanHtmlAi = html;
    } else {
      this.report.content.nextWeekPlanHtml = html;
    }
  }

  onCompletedModeChange(mode: ContentMode): void {
    this.completedMode = mode;
    this.markHtmlNeedsSync();
    if (mode === 'ai' && this.report && !this.report.content.completedWorkHtmlAi) {
      this.optimizeSection('completed');
    }
  }

  onPlanModeChange(mode: ContentMode): void {
    this.planMode = mode;
    this.markHtmlNeedsSync();
    if (mode === 'ai' && this.report && !this.report.content.nextWeekPlanHtmlAi) {
      this.optimizeSection('plan');
    }
  }

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
    void postSse(
      `${API_BASE}/worktime/reports/${reportId}/chat/stream`,
      { message },
      this.auth.token(),
      (ev) => {
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
    )
      .then(() => {
        this.chatting = false;
        this.scrollChat();
      })
      .catch((error: Error) => {
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
      });
  }

  askQuick(q: string): void {
    this.chatInput = q;
    this.sendChat();
  }

  onChatEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;
    e.preventDefault();
    this.sendChat();
  }

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

  copyMarkdown(): void {
    void navigator.clipboard
      .writeText(this.toMarkdown())
      .then(() => this.message.success('Markdown 已复制'));
  }

  copyHtml(): void {
    this.copyAs(this.toCopyHtml(), this.toMarkdown(), '带格式内容已复制');
  }

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

  private toMarkdown(): string {
    if (!this.report) return '';
    return [
      this.htmlToText(this.getCompletedHtml()),
      '',
      this.htmlToText(this.getPlanHtml()),
    ].join('\n');
  }

  private toCopyHtml(): string {
    if (!this.report) return '';
    return `${this.getCompletedHtml()}${this.getPlanHtml()}`;
  }

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

  private scrollChat(): void {
    setTimeout(() => {
      const el = this.chatListRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  private fail(
    error: { error?: { message?: string } },
    fallback: string,
    flag: 'uploading' | 'generating' | 'saving',
  ): void {
    this[flag] = false;
    this.message.error(error.error?.message || fallback);
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { API_BASE } from '../../core/api/api-base';
import { AuthService } from '../../core/auth/auth.service';

interface AiUsage {
  promptTokensTotal: number;
  completionTokensTotal: number;
  totalTokensTotal: number;
  requestCount: number;
  lastPromptTokens: number;
  lastCompletionTokens: number;
  lastTotalTokens: number;
  usageUpdatedAt: string | null;
}

interface AiSettings {
  provider: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  usage?: AiUsage;
}

interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  models: string[];
}

/** OpenAI 兼容协议厂商（Base URL 不含 /v1） */
const AI_PROVIDERS: ProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'deepseek-chat',
      'deepseek-reasoner',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    models: [
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4o',
      'gpt-4o-mini',
      'o3',
      'o3-mini',
      'o4-mini',
    ],
  },
  {
    id: 'qwen',
    label: '通义千问（DashScope）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    models: [
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
      'qwen-long',
      'qwen-max-latest',
      'qwen-plus-latest',
      'qwq-plus',
    ],
  },
  {
    id: 'moonshot',
    label: 'Moonshot（Kimi）',
    baseUrl: 'https://api.moonshot.cn',
    models: [
      'kimi-k2.5',
      'kimi-latest',
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
      'moonshot-v1-auto',
    ],
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-32B-Instruct',
      'Qwen/Qwen2.5-7B-Instruct',
      'THUDM/GLM-4-9B-0414',
    ],
  },
  {
    id: 'custom',
    label: '自定义（OpenAI 兼容）',
    baseUrl: '',
    models: [],
  },
];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
  ],
  template: `
    <nz-card nzTitle="系统配置" class="settings-card">
      <nz-alert
        nzType="info"
        nzShowIcon
        [nzMessage]="'当前用户：' + (auth.user()?.username || '管理员')"
        class="notice"
      ></nz-alert>

      <div class="usage-panel">
        <div class="usage-head">
          <div>
            <div class="usage-title">Token 用量提醒</div>
            <div class="usage-sub muted">
              基于本应用实际调用累计（厂商侧账单以官方后台为准）
              @if (usage.usageUpdatedAt) {
                · 最近更新 {{ usage.usageUpdatedAt | date: 'yyyy-MM-dd HH:mm' }}
              }
            </div>
          </div>
          <button
            nz-button
            nzSize="small"
            (click)="resetUsage()"
            [nzLoading]="resetting"
            [disabled]="!usage.totalTokensTotal && !usage.requestCount"
          >
            清零统计
          </button>
        </div>
        <div class="usage-grid">
          <div class="usage-item">
            <div class="num">{{ formatNum(usage.totalTokensTotal) }}</div>
            <div class="label">累计 Total</div>
          </div>
          <div class="usage-item">
            <div class="num">{{ formatNum(usage.promptTokensTotal) }}</div>
            <div class="label">累计 Prompt</div>
          </div>
          <div class="usage-item">
            <div class="num">{{ formatNum(usage.completionTokensTotal) }}</div>
            <div class="label">累计 Completion</div>
          </div>
          <div class="usage-item">
            <div class="num">{{ formatNum(usage.requestCount) }}</div>
            <div class="label">调用次数</div>
          </div>
        </div>
        <div class="usage-last muted">
          最近一次：Prompt {{ formatNum(usage.lastPromptTokens) }} · Completion
          {{ formatNum(usage.lastCompletionTokens) }} · Total
          {{ formatNum(usage.lastTotalTokens) }}
        </div>
      </div>

      <form nz-form nzLayout="vertical">
        <nz-form-item>
          <nz-form-label>Provider（厂商）</nz-form-label>
          <nz-form-control>
            <nz-select
              [(ngModel)]="settings.provider"
              name="provider"
              (ngModelChange)="onProviderChange($event)"
              style="width: 100%"
            >
              @for (p of providers; track p.id) {
                <nz-option [nzValue]="p.id" [nzLabel]="p.label"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>Base URL</nz-form-label>
          <nz-form-control>
            <nz-select
              [(ngModel)]="settings.baseUrl"
              name="baseUrl"
              nzShowSearch
              nzAllowClear
              nzPlaceHolder="选择或输入 Base URL"
              style="width: 100%"
              (nzOnSearch)="onBaseUrlSearch($event)"
            >
              @for (u of baseUrlOptions; track u) {
                <nz-option [nzValue]="u" [nzLabel]="u"></nz-option>
              }
              @if (baseUrlSearch && !baseUrlOptions.includes(baseUrlSearch)) {
                <nz-option
                  [nzValue]="baseUrlSearch"
                  [nzLabel]="baseUrlSearch + '（自定义）'"
                ></nz-option>
              }
            </nz-select>
            <small>请求路径为：Base URL + /v1/chat/completions</small>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>模型</nz-form-label>
          <nz-form-control>
            <nz-select
              [(ngModel)]="settings.model"
              name="model"
              nzShowSearch
              nzAllowClear
              nzPlaceHolder="选择或输入模型名"
              style="width: 100%"
              (nzOnSearch)="onModelSearch($event)"
            >
              @for (m of modelOptions; track m) {
                <nz-option [nzValue]="m" [nzLabel]="m"></nz-option>
              }
              @if (modelSearch && !modelOptions.includes(modelSearch)) {
                <nz-option
                  [nzValue]="modelSearch"
                  [nzLabel]="modelSearch + '（自定义）'"
                ></nz-option>
              }
            </nz-select>
            <small>可从列表选择，也可直接输入自定义模型名</small>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label>API Key</nz-form-label>
          <nz-form-control>
            <input
              nz-input
              type="password"
              [(ngModel)]="apiKey"
              name="apiKey"
              [placeholder]="settings.apiKeyMasked || '请输入 API Key'"
            />
            @if (settings.apiKeyConfigured) {
              <small>已配置；留空不会覆盖现有 Key。</small>
            }
          </nz-form-control>
        </nz-form-item>

        <button nz-button nzType="primary" (click)="save()" [nzLoading]="saving">保存配置</button>
        <button nz-button (click)="test()" [nzLoading]="testing">测试连接</button>
      </form>
      @if (testResult) {
        <nz-alert nzType="success" nzShowIcon [nzMessage]="testResult" class="notice"></nz-alert>
      }
    </nz-card>
  `,
  styles: [
    `
      .settings-card {
        max-width: 760px;
      }
      .notice {
        margin-bottom: 20px;
      }
      .usage-panel {
        margin-bottom: 20px;
        padding: 14px 16px;
        background: #f6ffed;
        border: 1px solid #b7eb8f;
        border-radius: 8px;
      }
      .usage-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .usage-title {
        font-weight: 600;
        color: #389e0d;
      }
      .usage-sub {
        margin-top: 4px;
        font-size: 12px;
      }
      .usage-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .usage-item {
        background: #fff;
        border: 1px solid #d9f7be;
        border-radius: 8px;
        padding: 10px 12px;
      }
      .usage-item .num {
        font-size: 18px;
        font-weight: 650;
        color: #237804;
        font-variant-numeric: tabular-nums;
      }
      .usage-item .label {
        margin-top: 2px;
        font-size: 12px;
        color: #8c8c8c;
      }
      .usage-last {
        margin-top: 10px;
        font-size: 12px;
      }
      .muted {
        color: #8c8c8c;
      }
      button + button {
        margin-left: 8px;
      }
      small {
        display: block;
        margin-top: 6px;
        color: #8c8c8c;
      }
      @media (max-width: 720px) {
        .usage-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  readonly auth = inject(AuthService);
  readonly providers = AI_PROVIDERS;

  settings: AiSettings = {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiKeyConfigured: false,
    apiKeyMasked: null,
  };
  apiKey = '';
  saving = false;
  testing = false;
  resetting = false;
  testResult = '';
  modelSearch = '';
  baseUrlSearch = '';

  get usage(): AiUsage {
    return (
      this.settings.usage || {
        promptTokensTotal: 0,
        completionTokensTotal: 0,
        totalTokensTotal: 0,
        requestCount: 0,
        lastPromptTokens: 0,
        lastCompletionTokens: 0,
        lastTotalTokens: 0,
        usageUpdatedAt: null,
      }
    );
  }

  get currentProvider(): ProviderPreset {
    return (
      this.providers.find((p) => p.id === this.settings.provider) ||
      this.providers[this.providers.length - 1]
    );
  }

  get modelOptions(): string[] {
    const list = [...this.currentProvider.models];
    if (this.settings.model && !list.includes(this.settings.model)) {
      list.unshift(this.settings.model);
    }
    return list;
  }

  get baseUrlOptions(): string[] {
    const list: string[] = [];
    if (this.currentProvider.baseUrl) list.push(this.currentProvider.baseUrl);
    if (this.settings.baseUrl && !list.includes(this.settings.baseUrl)) {
      list.unshift(this.settings.baseUrl);
    }
    return list;
  }

  ngOnInit(): void {
    this.loadSettings();
    this.auth.loadCurrentUser();
  }

  formatNum(n: number): string {
    return (n || 0).toLocaleString('zh-CN');
  }

  loadSettings(): void {
    this.http.get<AiSettings>(`${API_BASE}/settings/ai`).subscribe({
      next: (settings) => {
        this.applySettings(settings);
      },
    });
  }

  applySettings(settings: AiSettings): void {
    this.settings = settings;
    if (!this.providers.some((p) => p.id === settings.provider)) {
      this.settings.provider = 'custom';
    }
  }

  onProviderChange(providerId: string): void {
    const preset = this.providers.find((p) => p.id === providerId);
    if (!preset) return;
    this.settings.provider = preset.id;
    if (preset.baseUrl) {
      this.settings.baseUrl = preset.baseUrl;
    }
    if (preset.models.length) {
      this.settings.model = preset.models[0];
    }
    this.modelSearch = '';
    this.baseUrlSearch = '';
  }

  onModelSearch(value: string): void {
    this.modelSearch = (value || '').trim();
  }

  onBaseUrlSearch(value: string): void {
    this.baseUrlSearch = (value || '').trim();
  }

  save(): void {
    this.saving = true;
    const body = {
      provider: this.settings.provider,
      baseUrl: this.settings.baseUrl,
      model: this.settings.model,
      apiKey: this.apiKey,
    };
    this.http.put<AiSettings>(`${API_BASE}/settings/ai`, body).subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.apiKey = '';
        this.saving = false;
        this.message.success('AI 配置已保存');
      },
      error: (error: { error?: { message?: string } }) => {
        this.saving = false;
        this.message.error(error.error?.message || '保存失败');
      },
    });
  }

  test(): void {
    this.testing = true;
    this.testResult = '';
    this.http
      .post<AiSettings & { ok: boolean; reply: string }>(`${API_BASE}/settings/ai/test`, {})
      .subscribe({
        next: (result) => {
          this.testing = false;
          this.testResult = `连接成功：${result.reply}`;
          this.applySettings(result);
        },
        error: (error: { error?: { message?: string } }) => {
          this.testing = false;
          this.message.error(error.error?.message || '连接失败');
        },
      });
  }

  resetUsage(): void {
    this.resetting = true;
    this.http.post<AiSettings>(`${API_BASE}/settings/ai/usage/reset`, {}).subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.resetting = false;
        this.message.success('Token 统计已清零');
      },
      error: (error: { error?: { message?: string } }) => {
        this.resetting = false;
        this.message.error(error.error?.message || '清零失败');
      },
    });
  }
}

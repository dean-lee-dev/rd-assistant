/**
 * 系统配置页（/settings）
 *
 * 管理 AI 服务商与密钥（OpenAI 兼容协议），并展示 / 清零 Token 用量统计。
 * Key 仅提交至服务端存储，前端只展示是否已配置及脱敏值。
 */
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

/** AI Token 用量统计（累计 + 最近一次请求） */
interface AiUsage {
  /** 累计 prompt token 数 */
  promptTokensTotal: number;
  /** 累计 completion token 数 */
  completionTokensTotal: number;
  /** 累计总 token 数 */
  totalTokensTotal: number;
  /** 累计请求次数 */
  requestCount: number;
  /** 最近一次请求的 prompt token 数 */
  lastPromptTokens: number;
  /** 最近一次请求的 completion token 数 */
  lastCompletionTokens: number;
  /** 最近一次请求的总 token 数 */
  lastTotalTokens: number;
  /** 用量最近更新时间（ISO 字符串），无数据时为 null */
  usageUpdatedAt: string | null;
}

/** 服务端返回 / 表单绑定的 AI 配置 */
interface AiSettings {
  /** 厂商预设 id（如 deepseek、openai、custom） */
  provider: string;
  /** API Base URL（不含 /v1） */
  baseUrl: string;
  /** 模型名称 */
  model: string;
  /** 服务端是否已配置 API Key */
  apiKeyConfigured: boolean;
  /** 脱敏后的 Key 展示，未配置时为 null */
  apiKeyMasked: string | null;
  /** Token 用量统计（可选） */
  usage?: AiUsage;
}

/** 厂商预设：展示名、默认 Base URL 与可选模型列表 */
interface ProviderPreset {
  /** 预设唯一标识 */
  id: string;
  /** 下拉展示名称 */
  label: string;
  /** 默认 Base URL；自定义厂商可为空 */
  baseUrl: string;
  /** 推荐模型列表；自定义厂商可为空 */
  models: string[];
}

/**
 * OpenAI 兼容协议厂商预设（Base URL 不含 /v1）。
 * 含 DeepSeek / OpenAI / 通义 / Moonshot / SiliconFlow 及自定义项。
 */
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

/**
 * 系统配置页组件：AI 厂商 / Key / 模型配置，以及 Token 用量展示与清零。
 */
@Component({
  selector: 'app-settings',
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
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  /** HTTP 客户端 */
  private readonly http = inject(HttpClient);
  /** 全局消息提示 */
  private readonly message = inject(NzMessageService);
  /** 鉴权服务（加载当前用户等） */
  readonly auth = inject(AuthService);
  /** 厂商预设列表（模板下拉用） */
  readonly providers = AI_PROVIDERS;

  /** 当前 AI 配置（表单绑定 + 服务端回写） */
  settings: AiSettings = {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiKeyConfigured: false,
    apiKeyMasked: null,
  };
  /** 用户新输入的 API Key（保存成功后清空，不回显明文） */
  apiKey = '';
  /** 是否正在保存配置 */
  saving = false;
  /** 是否正在测试连接 */
  testing = false;
  /** 是否正在清零 Token 统计 */
  resetting = false;
  /** 连接测试成功时的回复文案 */
  testResult = '';
  /** 模型下拉的搜索关键字 */
  modelSearch = '';
  /** Base URL 下拉的搜索关键字 */
  baseUrlSearch = '';

  /** 当前 Token 用量；服务端未返回时给出全零默认值 */
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

  /** 当前选中的厂商预设；未知 id 时回退到「自定义」 */
  get currentProvider(): ProviderPreset {
    return (
      this.providers.find((p) => p.id === this.settings.provider) ||
      this.providers[this.providers.length - 1]
    );
  }

  /**
   * 模型下拉选项：预设模型列表，若当前 model 不在列表中则置顶插入。
   */
  get modelOptions(): string[] {
    const list = [...this.currentProvider.models];
    if (this.settings.model && !list.includes(this.settings.model)) {
      list.unshift(this.settings.model);
    }
    return list;
  }

  /**
   * Base URL 下拉选项：预设默认 URL + 当前已保存 URL（去重）。
   */
  get baseUrlOptions(): string[] {
    const list: string[] = [];
    if (this.currentProvider.baseUrl) list.push(this.currentProvider.baseUrl);
    if (this.settings.baseUrl && !list.includes(this.settings.baseUrl)) {
      list.unshift(this.settings.baseUrl);
    }
    return list;
  }

  /** 初始化：拉取 AI 配置并刷新当前用户 */
  ngOnInit(): void {
    this.loadSettings();
    this.auth.loadCurrentUser();
  }

  /**
   * 将数字格式化为中文区域千分位字符串。
   * @param n 原始数字
   */
  formatNum(n: number): string {
    return (n || 0).toLocaleString('zh-CN');
  }

  /** 从服务端加载 AI 配置 */
  loadSettings(): void {
    this.http.get<AiSettings>(`${API_BASE}/settings/ai`).subscribe({
      next: (settings) => {
        this.applySettings(settings);
      },
    });
  }

  /**
   * 应用服务端配置到表单；未知 provider 时映射为 custom。
   * @param settings 服务端返回的 AI 配置
   */
  applySettings(settings: AiSettings): void {
    this.settings = settings;
    if (!this.providers.some((p) => p.id === settings.provider)) {
      this.settings.provider = 'custom';
    }
  }

  /**
   * 切换厂商预设：同步默认 Base URL 与首个推荐模型，并清空搜索关键字。
   * @param providerId 厂商预设 id
   */
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

  /**
   * 更新模型下拉搜索关键字。
   * @param value 搜索输入
   */
  onModelSearch(value: string): void {
    this.modelSearch = (value || '').trim();
  }

  /**
   * 更新 Base URL 下拉搜索关键字。
   * @param value 搜索输入
   */
  onBaseUrlSearch(value: string): void {
    this.baseUrlSearch = (value || '').trim();
  }

  /** 保存 AI 配置（含可选新 Key）到服务端 */
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

  /** 使用当前已保存配置发起连通性测试，成功时展示回复并刷新用量 */
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

  /** 清零服务端 Token 用量统计 */
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

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSetting } from '../entities';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(AiSetting) private readonly settings: Repository<AiSetting>,
  ) {}

  async getSetting() {
    let row = await this.settings.findOne({ where: { id: 1 } });
    if (!row) {
      row = await this.settings.save(
        this.settings.create({
          provider: 'deepseek',
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          apiKey: null,
          promptTokensTotal: 0,
          completionTokensTotal: 0,
          totalTokensTotal: 0,
          requestCount: 0,
          lastPromptTokens: 0,
          lastCompletionTokens: 0,
          lastTotalTokens: 0,
          usageUpdatedAt: null,
        }),
      );
    }
    return row;
  }

  async getPublicSetting() {
    const s = await this.getSetting();
    return {
      provider: s.provider,
      baseUrl: s.baseUrl,
      model: s.model,
      apiKeyConfigured: Boolean(s.apiKey),
      apiKeyMasked: s.apiKey ? maskKey(s.apiKey) : null,
      usage: {
        promptTokensTotal: s.promptTokensTotal || 0,
        completionTokensTotal: s.completionTokensTotal || 0,
        totalTokensTotal: s.totalTokensTotal || 0,
        requestCount: s.requestCount || 0,
        lastPromptTokens: s.lastPromptTokens || 0,
        lastCompletionTokens: s.lastCompletionTokens || 0,
        lastTotalTokens: s.lastTotalTokens || 0,
        usageUpdatedAt: s.usageUpdatedAt,
      },
    };
  }

  async updateSetting(input: {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  }) {
    const s = await this.getSetting();
    if (input.provider != null) s.provider = input.provider;
    if (input.baseUrl != null) s.baseUrl = input.baseUrl.replace(/\/$/, '');
    if (input.model != null) s.model = input.model;
    if (input.apiKey != null && input.apiKey.trim() !== '') {
      s.apiKey = input.apiKey.trim();
    }
    await this.settings.save(s);
    return this.getPublicSetting();
  }

  async resetUsage() {
    const s = await this.getSetting();
    s.promptTokensTotal = 0;
    s.completionTokensTotal = 0;
    s.totalTokensTotal = 0;
    s.requestCount = 0;
    s.lastPromptTokens = 0;
    s.lastCompletionTokens = 0;
    s.lastTotalTokens = 0;
    s.usageUpdatedAt = null;
    await this.settings.save(s);
    return this.getPublicSetting();
  }

  async testConnection() {
    const reply = await this.chat(
      [{ role: 'user', content: '请只回复：ok' }],
      { temperature: 0, maxTokens: 16 },
    );
    return { ok: true, reply: reply.slice(0, 200), ...(await this.getPublicSetting()) };
  }

  async chat(
    messages: ChatMessage[],
    opts?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    let full = '';
    for await (const chunk of this.chatStream(messages, opts)) {
      full += chunk;
    }
    if (!full) throw new BadRequestException('AI 返回为空');
    return full;
  }

  /** OpenAI 兼容流式输出，逐段 yield 文本 delta；并累计 usage */
  async *chatStream(
    messages: ChatMessage[],
    opts?: { temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    const s = await this.getSetting();
    if (!s.apiKey) {
      throw new BadRequestException('未配置 AI API Key，请先在系统配置中填写');
    }
    const url = `${s.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const payloadBase = {
      model: s.model,
      messages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 4096,
      stream: true,
    };
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.apiKey}`,
      },
      body: JSON.stringify({
        ...payloadBase,
        stream_options: { include_usage: true },
      }),
    });
    // 部分兼容接口不支持 stream_options，降级重试
    if (!res.ok) {
      const text = await res.text();
      if (/stream_options|unknown|unsupported|invalid/i.test(text)) {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s.apiKey}`,
          },
          body: JSON.stringify(payloadBase),
        });
      } else {
        throw new BadRequestException(`AI 调用失败 (${res.status}): ${text.slice(0, 500)}`);
      }
    }
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`AI 调用失败 (${res.status}): ${text.slice(0, 500)}`);
    }
    if (!res.body) throw new BadRequestException('AI 未返回流式响应体');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastUsage: TokenUsage | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          if (lastUsage) await this.recordUsage(lastUsage);
          return;
        }
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string }; message?: { content?: string } }[];
            usage?: TokenUsage;
          };
          if (json.usage) lastUsage = json.usage;
          const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
          if (delta) yield delta;
        } catch {
          // 忽略非 JSON 行
        }
      }
    }
    if (lastUsage) await this.recordUsage(lastUsage);
  }

  private async recordUsage(usage: TokenUsage) {
    const prompt = Math.max(0, Number(usage.prompt_tokens) || 0);
    const completion = Math.max(0, Number(usage.completion_tokens) || 0);
    const total =
      Math.max(0, Number(usage.total_tokens) || 0) || prompt + completion;
    if (!prompt && !completion && !total) return;

    const s = await this.getSetting();
    s.promptTokensTotal = (s.promptTokensTotal || 0) + prompt;
    s.completionTokensTotal = (s.completionTokensTotal || 0) + completion;
    s.totalTokensTotal = (s.totalTokensTotal || 0) + total;
    s.requestCount = (s.requestCount || 0) + 1;
    s.lastPromptTokens = prompt;
    s.lastCompletionTokens = completion;
    s.lastTotalTokens = total;
    s.usageUpdatedAt = new Date();
    await this.settings.save(s);
  }
}

function maskKey(key: string) {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

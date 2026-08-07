import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatStreamOptions {
  temperature?: number;
  maxTokens?: number;
  /** DeepSeek V4 等：关闭 thinking，避免短 max_tokens 被推理占满导致 content 为空 */
  disableThinking?: boolean;
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetting() {
    let row = await this.prisma.aiSetting.findUnique({ where: { id: 1 } });
    if (!row) {
      row = await this.prisma.aiSetting.create({
        data: {
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
        },
      });
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
    await this.prisma.aiSetting.update({
      where: { id: s.id },
      data: {
        provider: input.provider ?? s.provider,
        baseUrl:
          input.baseUrl != null ? input.baseUrl.replace(/\/$/, '') : s.baseUrl,
        model: input.model ?? s.model,
        apiKey:
          input.apiKey != null && input.apiKey.trim() !== ''
            ? input.apiKey.trim()
            : s.apiKey,
      },
    });
    return this.getPublicSetting();
  }

  async resetUsage() {
    const s = await this.getSetting();
    await this.prisma.aiSetting.update({
      where: { id: s.id },
      data: {
        promptTokensTotal: 0,
        completionTokensTotal: 0,
        totalTokensTotal: 0,
        requestCount: 0,
        lastPromptTokens: 0,
        lastCompletionTokens: 0,
        lastTotalTokens: 0,
        usageUpdatedAt: null,
      },
    });
    return this.getPublicSetting();
  }

  async testConnection() {
    // deepseek-v4-* 默认开 thinking：过小的 max_tokens 会被推理占满，content 为空
    const reply = await this.chat(
      [{ role: 'user', content: '请只回复：ok' }],
      { temperature: 0, maxTokens: 64, disableThinking: true },
    );
    return { ok: true, reply: reply.slice(0, 200), ...(await this.getPublicSetting()) };
  }

  async chat(
    messages: ChatMessage[],
    opts?: ChatStreamOptions,
  ): Promise<string> {
    let full = '';
    for await (const chunk of this.chatStream(messages, opts)) {
      full += chunk;
    }
    if (!full) {
      throw new BadRequestException(
        'AI 返回为空（若使用 deepseek-v4，可能是 thinking 占满了 max_tokens，请增大上限或关闭思考）',
      );
    }
    return full;
  }

  /** OpenAI 兼容流式输出，逐段 yield 文本 delta；并累计 usage */
  async *chatStream(
    messages: ChatMessage[],
    opts?: ChatStreamOptions,
  ): AsyncGenerator<string> {
    const s = await this.getSetting();
    if (!s.apiKey) {
      throw new BadRequestException('未配置 AI API Key，请先在系统配置中填写');
    }
    const url = `${s.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const payloadBase: Record<string, unknown> = {
      model: s.model,
      messages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens ?? 4096,
      stream: true,
    };
    // DeepSeek V4：thinking 默认开启；短请求需显式关闭，否则易 content 为空
    if (opts?.disableThinking) {
      payloadBase.thinking = { type: 'disabled' };
    }
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
    await this.prisma.aiSetting.update({
      where: { id: s.id },
      data: {
        promptTokensTotal: (s.promptTokensTotal || 0) + prompt,
        completionTokensTotal: (s.completionTokensTotal || 0) + completion,
        totalTokensTotal: (s.totalTokensTotal || 0) + total,
        requestCount: (s.requestCount || 0) + 1,
        lastPromptTokens: prompt,
        lastCompletionTokens: completion,
        lastTotalTokens: total,
        usageUpdatedAt: new Date(),
      },
    });
  }
}

function maskKey(key: string) {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

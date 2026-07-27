import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSetting } from '../entities';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

  async testConnection() {
    const reply = await this.chat(
      [{ role: 'user', content: '请只回复：ok' }],
      { temperature: 0, maxTokens: 16 },
    );
    return { ok: true, reply: reply.slice(0, 200) };
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

  /** OpenAI 兼容流式输出，逐段 yield 文本 delta */
  async *chatStream(
    messages: ChatMessage[],
    opts?: { temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    const s = await this.getSetting();
    if (!s.apiKey) {
      throw new BadRequestException('未配置 AI API Key，请先在系统配置中填写');
    }
    const url = `${s.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.apiKey}`,
      },
      body: JSON.stringify({
        model: s.model,
        messages,
        temperature: opts?.temperature ?? 0.3,
        max_tokens: opts?.maxTokens ?? 4096,
        stream: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`AI 调用失败 (${res.status}): ${text.slice(0, 500)}`);
    }
    if (!res.body) throw new BadRequestException('AI 未返回流式响应体');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
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
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string }; message?: { content?: string } }[];
          };
          const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
          if (delta) yield delta;
        } catch {
          // 忽略非 JSON 行
        }
      }
    }
  }
}

function maskKey(key: string) {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

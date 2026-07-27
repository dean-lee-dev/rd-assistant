export type SseEvent = {
  type?: string;
  content?: string;
  message?: string;
  markdown?: string;
  scope?: string;
  selectedIds?: number[];
  count?: number;
  chatMessages?: { role: 'user' | 'assistant'; content: string; at?: string }[];
  [key: string]: unknown;
};

/**
 * POST + SSE（带 Authorization）。回调每个 data 事件。
 */
export async function postSse(
  url: string,
  body: unknown,
  token: string | null,
  onEvent: (ev: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text.slice(0, 300) || `请求失败 (${res.status})`;
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (typeof json.message === 'string') message = json.message;
      else if (Array.isArray(json.message)) message = json.message.join('; ');
    } catch {
      // keep text
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error('服务器未返回流式响应');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';
    for (const raw of parts) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const ev = JSON.parse(data) as SseEvent;
        onEvent(ev);
        if (ev.type === 'error') {
          throw new Error(ev.message || '流式请求失败');
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

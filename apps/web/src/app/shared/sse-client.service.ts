import {
  HttpClient,
  HttpDownloadProgressEvent,
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, OperatorFunction, catchError, map, mergeMap, throwError } from 'rxjs';

/**
 * SSE `data:` 行解析后的事件载荷。
 * 具体字段随业务接口变化（分析流、对话流等）。
 */
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
 * 基于 Angular HttpClient 的 POST + SSE 流式客户端。
 * Authorization 由 `authInterceptor` 统一附加，调用方无需传 token。
 */
@Injectable({ providedIn: 'root' })
export class SseClient {
  private readonly http = inject(HttpClient);

  /**
   * 以 POST 发起 SSE 流式请求，逐条发出 `data:` 事件。
   * 取消订阅即中止请求。
   *
   * @param url 完整请求地址
   * @param body JSON 请求体
   * @throws {Error} HTTP 非 2xx，或服务端 `type === 'error'` 事件
   */
  postSse(url: string, body: unknown = {}): Observable<SseEvent> {
    let processed = 0;
    let lineBuffer = '';

    return this.http
      .post(url, body ?? {}, {
        observe: 'events',
        responseType: 'text',
        reportProgress: true,
        headers: new HttpHeaders({
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        }),
      })
      .pipe(
        map((event: HttpEvent<string>) => {
          const chunk = this.takeNewText(event, () => processed, (n) => {
            processed = n;
          });
          if (chunk === null) return [] as SseEvent[];
          const { events, rest } = parseSseText(lineBuffer + chunk);
          lineBuffer = rest;
          return events;
        }),
        mergeMap((events) => events),
        throwOnSseError(),
        catchError((err: unknown) => throwError(() => toSseError(err))),
      );
  }

  /** 从 DownloadProgress / Response 取出相对上次未处理的新增文本；其它事件返回 null */
  private takeNewText(
    event: HttpEvent<string>,
    getProcessed: () => number,
    setProcessed: (n: number) => void,
  ): string | null {
    if (event.type === HttpEventType.DownloadProgress) {
      const partial = (event as HttpDownloadProgressEvent).partialText ?? '';
      const from = getProcessed();
      setProcessed(partial.length);
      return partial.slice(from);
    }
    if (event.type === HttpEventType.Response) {
      const body = (event as HttpResponse<string>).body ?? '';
      const from = getProcessed();
      setProcessed(body.length);
      return body.slice(from);
    }
    return null;
  }
}

/** 将累计文本拆成完整 SSE 事件；末行不完整则留在 `rest` */
function parseSseText(text: string): { events: SseEvent[]; rest: string } {
  const parts = text.split('\n');
  const rest = parts.pop() ?? '';
  const events: SseEvent[] = [];
  for (const raw of parts) {
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as SseEvent);
    } catch {
      // 非 JSON 行忽略
    }
  }
  return { events, rest };
}

function throwOnSseError(): OperatorFunction<SseEvent, SseEvent> {
  return mergeMap((ev) => {
    if (ev.type === 'error') {
      return throwError(() => new Error(ev.message || '流式请求失败'));
    }
    return [ev];
  });
}

function toSseError(err: unknown): Error {
  if (err instanceof Error && !(err instanceof HttpErrorResponse)) {
    return err;
  }
  if (err instanceof HttpErrorResponse) {
    const text =
      typeof err.error === 'string'
        ? err.error
        : err.error != null
          ? JSON.stringify(err.error)
          : err.message;
    let message = (text || `请求失败 (${err.status})`).slice(0, 300);
    try {
      const json =
        typeof err.error === 'object' && err.error !== null
          ? (err.error as { message?: string | string[] })
          : (JSON.parse(text) as { message?: string | string[] });
      if (typeof json.message === 'string') message = json.message;
      else if (Array.isArray(json.message)) message = json.message.join('; ');
    } catch {
      // keep message
    }
    return new Error(message);
  }
  return new Error(String(err));
}

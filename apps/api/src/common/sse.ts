import type { FastifyReply } from 'fastify';

/**
 * 初始化 SSE：hijack 原始响应，写入 event-stream 头。
 * 协议保持 `data: JSON\n\n`，前端 SseClient 无需改动。
 */
export function initSse(reply: FastifyReply): void {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

export function writeSse(reply: FastifyReply, payload: unknown): void {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function endSse(reply: FastifyReply): void {
  reply.raw.write('data: {"type":"close"}\n\n');
  reply.raw.end();
}

import { Response } from 'express';

export function initSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // flush headers early
  res.flushHeaders?.();
}

export function writeSse(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function endSse(res: Response): void {
  res.write('data: {"type":"close"}\n\n');
  res.end();
}

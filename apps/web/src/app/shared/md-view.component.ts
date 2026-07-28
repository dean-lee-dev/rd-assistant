import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Markdown 预览组件：将文本渲染为安全 HTML，支持流式输出光标样式。
 *
 * @example
 * ```html
 * <app-md-view [content]="markdown" [streaming]="loading"></app-md-view>
 * ```
 */
@Component({
  selector: 'app-md-view',
  templateUrl: './md-view.component.html',
  styleUrl: './md-view.component.scss',
})
export class MdViewComponent {
  /** 已消毒、可绑定到 `[innerHTML]` 的 HTML。 */
  html: SafeHtml = '';

  /** 原始 Markdown 文本缓存。 */
  private raw = '';

  /** 为 true 时展示流式输出光标动画。 */
  @Input() streaming = false;

  /**
   * Markdown 正文；变更时重新解析并消毒。
   * @param value Markdown 源文本
   */
  @Input() set content(value: string | null | undefined) {
    this.raw = value || '';
    this.render();
  }

  constructor(private readonly sanitizer: DomSanitizer) {}

  /** 解析 Markdown → DOMPurify 消毒 → 信任为 SafeHtml。 */
  private render(): void {
    const parsed = marked.parse(this.raw || '') as string;
    const clean = DOMPurify.sanitize(parsed, {
      USE_PROFILES: { html: true },
    });
    this.html = this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}

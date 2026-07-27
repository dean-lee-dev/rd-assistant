import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

@Component({
  selector: 'app-md-view',
  standalone: true,
  template: `<div class="md-view" [class.streaming]="streaming" [innerHTML]="html"></div>`,
  styles: [
    `
      .md-view {
        line-height: 1.65;
        color: #262626;
        word-break: break-word;
      }
      .md-view :where(h1, h2, h3, h4) {
        margin: 0.9em 0 0.45em;
        font-weight: 600;
        line-height: 1.35;
      }
      .md-view h1 {
        font-size: 1.35em;
      }
      .md-view h2 {
        font-size: 1.2em;
      }
      .md-view h3 {
        font-size: 1.08em;
      }
      .md-view h4 {
        font-size: 1em;
      }
      .md-view p {
        margin: 0.45em 0;
      }
      .md-view ul,
      .md-view ol {
        margin: 0.4em 0 0.6em;
        padding-left: 1.4em;
      }
      .md-view li {
        margin: 0.2em 0;
      }
      .md-view code {
        font-family: Consolas, 'Courier New', monospace;
        background: #f5f5f5;
        border-radius: 4px;
        padding: 0.1em 0.35em;
        font-size: 0.92em;
      }
      .md-view pre {
        background: #f5f5f5;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        padding: 10px 12px;
        overflow: auto;
      }
      .md-view pre code {
        background: transparent;
        padding: 0;
      }
      .md-view blockquote {
        margin: 0.6em 0;
        padding: 0.2em 0 0.2em 12px;
        border-left: 3px solid #91caff;
        color: #595959;
      }
      .md-view hr {
        border: none;
        border-top: 1px solid #f0f0f0;
        margin: 12px 0;
      }
      .md-view table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.6em 0;
        font-size: 13px;
      }
      .md-view th,
      .md-view td {
        border: 1px solid #f0f0f0;
        padding: 6px 8px;
        text-align: left;
      }
      .md-view th {
        background: #fafafa;
      }
      .md-view.streaming::after {
        content: '';
        display: inline-block;
        width: 7px;
        height: 1em;
        margin-left: 3px;
        background: #1677ff;
        border-radius: 1px;
        animation: blink 1s step-end infinite;
        vertical-align: text-bottom;
      }
      @keyframes blink {
        50% {
          opacity: 0;
        }
      }
    `,
  ],
})
export class MdViewComponent {
  html: SafeHtml = '';
  private raw = '';
  @Input() streaming = false;

  @Input() set content(value: string | null | undefined) {
    this.raw = value || '';
    this.render();
  }

  constructor(private readonly sanitizer: DomSanitizer) {}

  private render(): void {
    const parsed = marked.parse(this.raw || '') as string;
    const clean = DOMPurify.sanitize(parsed, {
      USE_PROFILES: { html: true },
    });
    this.html = this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}

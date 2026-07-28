import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * 应用根组件，仅承载顶层 `router-outlet`。
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  /** 应用标题（预留）。 */
  title = 'web';
}

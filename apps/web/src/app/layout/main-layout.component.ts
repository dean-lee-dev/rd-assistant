import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AuthService } from '../core/auth/auth.service';

/**
 * 主布局：侧栏菜单 + 顶栏用户信息，承载登录后的业务子路由。
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NzLayoutModule, NzMenuModule, NzIconModule, NzButtonModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  /** 鉴权服务（模板读取当前用户）。 */
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** 退出登录并跳转登录页。 */
  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}

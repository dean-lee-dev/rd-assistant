import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NzLayoutModule, NzMenuModule, NzIconModule, NzButtonModule],
  template: `
    <nz-layout class="shell">
      <nz-sider nzWidth="220" nzTheme="dark">
        <div class="brand"><span nz-icon nzType="dashboard"></span> 研发效能助手</div>
        <ul nz-menu nzTheme="dark" nzMode="inline">
          <li nz-menu-item routerLink="/weekly-report" routerLinkActive="ant-menu-item-selected">
            <span nz-icon nzType="file-text"></span><span>工时周报</span>
          </li>
          <li nz-menu-item routerLink="/system-config-params" routerLinkActive="ant-menu-item-selected">
            <span nz-icon nzType="database"></span><span>配置洞察</span>
          </li>
          <li nz-menu-item routerLink="/settings" routerLinkActive="ant-menu-item-selected">
            <span nz-icon nzType="setting"></span><span>系统配置</span>
          </li>
        </ul>
      </nz-sider>
      <nz-layout>
        <nz-header class="header">
          <span>个人研发效能助手</span>
          <div>
            <span nz-icon nzType="user"></span> {{ auth.user()?.username || '管理员' }}
            <button nz-button nzType="link" (click)="logout()">退出</button>
          </div>
        </nz-header>
        <nz-content class="content"><router-outlet /></nz-content>
      </nz-layout>
    </nz-layout>
  `,
  styles: [`
    .shell { min-height: 100vh; }
    .brand { height: 64px; padding: 0 22px; color: #fff; display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600; }
    .header { background: #fff; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgb(0 0 0 / 8%); }
    .content { margin: 20px; }
  `],
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}

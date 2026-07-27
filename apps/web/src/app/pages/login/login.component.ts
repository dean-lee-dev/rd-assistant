import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzFormModule, NzIconModule, NzInputModule],
  template: `
    <main class="login-page">
      <nz-card class="login-card" nzTitle="个人研发效能助手">
        <nz-alert nzType="info" nzShowIcon nzMessage="默认账号：admin / admin123" class="hint"></nz-alert>
        <form nz-form (ngSubmit)="submit()">
          <nz-form-item><nz-form-control>
            <nz-input-group nzPrefixIcon="user"><input nz-input name="username" [(ngModel)]="username" placeholder="用户名" required /></nz-input-group>
          </nz-form-control></nz-form-item>
          <nz-form-item><nz-form-control>
            <nz-input-group nzPrefixIcon="lock"><input nz-input name="password" [(ngModel)]="password" type="password" placeholder="密码" required /></nz-input-group>
          </nz-form-control></nz-form-item>
          @if (error) { <nz-alert nzType="error" [nzMessage]="error" class="hint"></nz-alert> }
          <button nz-button nzType="primary" class="login-button" [nzLoading]="loading" [disabled]="!username || !password">登录</button>
        </form>
      </nz-card>
    </main>
  `,
  styles: [`
    .login-page { min-height: 100vh; display: grid; place-items: center; background: linear-gradient(135deg, #e6f4ff, #f6ffed); }
    .login-card { width: 380px; }
    .hint { margin-bottom: 20px; }
    .login-button { width: 100%; }
  `],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  username = 'admin';
  password = 'admin123';
  loading = false;
  error = '';

  submit(): void {
    this.loading = true;
    this.error = '';
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        void this.router.navigate(['/weekly-report']);
      },
      error: (response: { error?: { message?: string } }) => {
        this.error = response.error?.message || '登录失败，请检查服务和账号密码';
        this.loading = false;
      },
    });
  }
}

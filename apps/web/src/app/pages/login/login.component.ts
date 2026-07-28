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

/**
 * 登录页：单用户账号密码登录，成功后进入工时周报。
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzFormModule, NzIconModule, NzInputModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** 用户名（默认预填管理员）。 */
  username = 'admin';

  /** 密码（默认预填初始密码，便于本地开发）。 */
  password = 'admin123';

  /** 登录请求进行中。 */
  loading = false;

  /** 登录失败提示文案。 */
  error = '';

  /** 提交登录表单。 */
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

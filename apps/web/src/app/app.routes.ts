import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { MainLayoutComponent } from './layout/main-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { SysParamsComponent } from './pages/sys-params/sys-params.component';
import { WeeklyReportComponent } from './pages/weekly-report/weekly-report.component';

/**
 * 应用路由表。
 * - `/login`：公开登录页
 * - `/`：需登录的主布局，默认进入工时周报
 */
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'weekly-report' },
      { path: 'weekly-report', component: WeeklyReportComponent },
      { path: 'system-config-params', component: SysParamsComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];

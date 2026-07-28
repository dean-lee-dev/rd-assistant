import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE } from '../api/api-base';

/** 当前登录用户信息。 */
export interface CurrentUser {
  id: number;
  username: string;
}

/** 登录接口响应。 */
interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

/**
 * 鉴权服务：登录/登出、Token 存取、当前用户状态。
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** localStorage 中 JWT 的键名。 */
  private readonly tokenKey = 'rd_token';

  /** 当前用户响应式状态。 */
  readonly user = signal<CurrentUser | null>(this.readUser());

  constructor(private readonly http: HttpClient) {}

  /**
   * 账号密码登录，成功后写入 Token 与用户信息。
   * @param username 用户名
   * @param password 密码
   */
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE}/auth/login`, { username, password }).pipe(
      tap(({ accessToken, user }) => {
        localStorage.setItem(this.tokenKey, accessToken);
        localStorage.setItem('rd_user', JSON.stringify(user));
        this.user.set(user);
      }),
    );
  }

  /** 读取本地 JWT，未登录时返回 `null`。 */
  token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /** 是否已登录（以本地 Token 是否存在为准）。 */
  isLoggedIn(): boolean {
    return Boolean(this.token());
  }

  /** 清除本地登录态。 */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('rd_user');
    this.user.set(null);
  }

  /**
   * 从服务端刷新当前用户；失败则登出。
   * 无 Token 时直接返回。
   */
  loadCurrentUser(): void {
    if (!this.isLoggedIn()) return;
    this.http.get<CurrentUser>(`${API_BASE}/auth/me`).subscribe({
      next: (user) => {
        localStorage.setItem('rd_user', JSON.stringify(user));
        this.user.set(user);
      },
      error: () => this.logout(),
    });
  }

  /** 从 localStorage 解析缓存用户，解析失败返回 `null`。 */
  private readUser(): CurrentUser | null {
    try {
      const value = localStorage.getItem('rd_user');
      return value ? (JSON.parse(value) as CurrentUser) : null;
    } catch {
      return null;
    }
  }
}

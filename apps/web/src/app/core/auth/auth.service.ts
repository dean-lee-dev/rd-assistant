import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE } from '../api/api-base';

export interface CurrentUser {
  id: number;
  username: string;
}

interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'rd_token';
  readonly user = signal<CurrentUser | null>(this.readUser());

  constructor(private readonly http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE}/auth/login`, { username, password }).pipe(
      tap(({ accessToken, user }) => {
        localStorage.setItem(this.tokenKey, accessToken);
        localStorage.setItem('rd_user', JSON.stringify(user));
        this.user.set(user);
      }),
    );
  }

  token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return Boolean(this.token());
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('rd_user');
    this.user.set(null);
  }

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

  private readUser(): CurrentUser | null {
    try {
      const value = localStorage.getItem('rd_user');
      return value ? (JSON.parse(value) as CurrentUser) : null;
    } catch {
      return null;
    }
  }
}

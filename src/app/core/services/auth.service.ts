import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map, timeout, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';

const USER_KEY = 'ferromaderas_user';

/** Limpia JWT legado en localStorage (antes era Bearer en cliente). */
const LEGACY_TOKEN_KEY = 'ferromaderas_token';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'vendedor' | 'administrador' | 'gerente' | 'editor' | 'cliente';
  permissions: string[];
}

interface LoginResponse {
  user?: AuthUser;
  requiresTwoFactor?: boolean;
  challengeToken?: string;
  emailHint?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${environment.apiUrl}/auth`;

  private userData = signal<AuthUser | null>(this.loadCachedUser());
  /** Evita GET /me en cada clic dentro del admin; se resetea en 401 o logout. */
  private sessionConfirmed = false;

  currentUser = computed(() => this.userData());
  /** Sesión válida si hay usuario en memoria (validado vía /me en el guard). */
  isAuthenticated = computed(() => !!this.userData());

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }

  private loadCachedUser(): AuthUser | null {
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
  }

  private persistUser(user: AuthUser): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('ferromaderas_admin_user', user.name);
    this.userData.set(user);
    this.sessionConfirmed = true;
  }

  private clearLocalProfile(): void {
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem('ferromaderas_admin_user');
    this.userData.set(null);
    this.sessionConfirmed = false;
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.api}/login`, { username, password }).pipe(
      timeout(20000),
      tap((res) => {
        if (res.user && !res.requiresTwoFactor) this.persistUser(res.user);
      })
    );
  }

  verifyTwoFactor(challengeToken: string, code: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/verify-2fa`, { challengeToken, code })
      .pipe(
        timeout(15000),
        tap((res) => {
          if (res.user) this.persistUser(res.user);
        }),
      );
  }

  resendTwoFactor(
    challengeToken: string,
  ): Observable<{ challengeToken: string; emailHint: string }> {
    return this.http
      .post<{ challengeToken: string; emailHint: string }>(`${this.api}/resend-2fa`, {
        challengeToken,
      })
      .pipe(timeout(15000));
  }

  logout(): void {
    this.http
      .post<{ ok: boolean }>(`${this.api}/logout`, {})
      .pipe(
        finalize(() => {
          this.clearLocalProfile();
          void this.router.navigate(['/admin-login']);
        })
      )
      .subscribe({ error: () => {} });
  }

  /** Tras 401: borra perfil local e intenta invalidar cookie en el servidor. */
  clearSessionAfterUnauthorized(): void {
    this.clearLocalProfile();
    this.http.post<{ ok: boolean }>(`${this.api}/logout`, {}).subscribe({ error: () => {} });
  }

  hasPermission(slug: string): boolean {
    const perms = this.userData()?.permissions ?? [];
    return perms.includes(slug);
  }

  hasRole(role: string): boolean {
    return this.userData()?.role === role;
  }

  /** Valida sesión con el servidor (cookie HttpOnly). Siempre consulta /me para detectar cookies expiradas. */
  ensureSession(): Observable<boolean> {
    return this.http.get<{ user: AuthUser | null }>(`${this.api}/me`).pipe(
      tap((res) => {
        if (res.user) this.persistUser(res.user);
        else this.clearLocalProfile();
      }),
      map((res) => !!res.user),
      catchError(() => {
        this.clearLocalProfile();
        return of(false);
      })
    );
  }

  refreshMe(): Observable<AuthUser | null> {
    return this.http.get<{ user: AuthUser | null }>(`${this.api}/me`).pipe(
      tap((res) => {
        if (res.user) this.persistUser(res.user);
        else {
          this.clearLocalProfile();
        }
      }),
      map((res) => res.user),
      catchError(() => {
        this.clearLocalProfile();
        return of(null);
      })
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.api}/forgot-password`, {
        email: email.trim().toLowerCase(),
      })
      .pipe(timeout(15000));
  }

  registerClient(
    email: string,
    password: string,
    name: string,
    phone?: string,
  ): Observable<{ user: AuthUser; linkedQuotes: number }> {
    return this.http
      .post<{ user: AuthUser; linkedQuotes: number }>(`${this.api}/register-client`, {
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        phone: phone?.trim(),
      })
      .pipe(
        tap((res) => {
          if (res.user) this.persistUser(res.user);
        }),
      );
  }

  /** Compatibilidad: antes existía initFromStorage(); el estado sale de sessionStorage en el constructor. */
  initFromStorage(): void {
    this.userData.set(this.loadCachedUser());
  }
}

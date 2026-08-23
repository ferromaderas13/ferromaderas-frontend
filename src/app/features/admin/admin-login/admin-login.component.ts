import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { clientFacingHttpMessage } from '../../../core/http/client-facing-error';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  /** Patrón básico de correo: algo@dominio.ext (evita "1", símbolos sueltos, etc.) */
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  username = '';
  password = '';
  loading = false;
  error = '';

  step: 'credentials' | 'otp' = 'credentials';
  otpCode = '';
  challengeToken = '';
  emailHint = '';
  resendLoading = false;

  showForgotPassword = false;
  forgotEmail = '';
  forgotLoading = false;
  forgotError = '';
  forgotSuccess = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  onSubmit(): void {
    this.error = '';
    if (!this.username?.trim()) {
      this.error = 'Ingresa tu usuario';
      return;
    }
    if (!this.password) {
      this.error = 'Ingresa tu contraseña';
      return;
    }
    this.loading = true;
    this.auth.login(this.username.trim(), this.password).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.requiresTwoFactor && res.challengeToken) {
          this.step = 'otp';
          this.challengeToken = res.challengeToken;
          this.emailHint = res.emailHint ?? '';
          this.otpCode = '';
          this.password = '';
          this.cdr.detectChanges();
          return;
        }
        this.goToAdmin();
      },
      error: (err) => {
        const setError = () => {
          this.loading = false;
          if (!err) {
            this.error = 'No se pudo iniciar sesión. Intenta de nuevo.';
            this.cdr.detectChanges();
            return;
          }
          if ((err as { name?: string })?.name === 'TimeoutError') {
            this.error = 'El servidor tardó demasiado en responder. Intenta más tarde.';
            this.cdr.detectChanges();
            return;
          }
          const status = (err as { status?: number; statusCode?: number })?.status ??
            (err as { statusCode?: number }).statusCode;
          if (status === 401) {
            this.error = 'Usuario o contraseña incorrectos.';
          } else {
            this.error = clientFacingHttpMessage(
              err,
              'Error al iniciar sesión. Intenta de nuevo.'
            );
          }
          this.cdr.detectChanges();
        };
        this.ngZone.run(setError);
      },
    });
  }

  onVerifyOtp(): void {
    this.error = '';
    const code = this.otpCode.replace(/\D/g, '');
    if (code.length !== 6) {
      this.error = 'Ingresa el código de 6 dígitos que enviamos a tu correo.';
      return;
    }
    this.loading = true;
    this.auth.verifyTwoFactor(this.challengeToken, code).subscribe({
      next: () => {
        this.loading = false;
        this.goToAdmin();
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loading = false;
          this.error = clientFacingHttpMessage(
            err,
            'No se pudo verificar el código. Intenta de nuevo.',
          );
          this.cdr.detectChanges();
        });
      },
    });
  }

  resendOtp(): void {
    this.error = '';
    this.resendLoading = true;
    this.auth.resendTwoFactor(this.challengeToken).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.resendLoading = false;
          this.challengeToken = res.challengeToken;
          this.emailHint = res.emailHint ?? this.emailHint;
          this.otpCode = '';
          this.error = '';
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.resendLoading = false;
          this.error = clientFacingHttpMessage(
            err,
            'No se pudo reenviar el código. Intenta de nuevo.',
          );
          this.cdr.detectChanges();
        });
      },
    });
  }

  backToCredentials(): void {
    this.step = 'credentials';
    this.otpCode = '';
    this.challengeToken = '';
    this.emailHint = '';
    this.error = '';
  }

  private goToAdmin(): void {
    let returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/dashboard';
    if (!returnUrl.startsWith('/admin')) returnUrl = '/admin/dashboard';
    setTimeout(() => {
      this.router.navigateByUrl(returnUrl);
    }, 50);
  }

  onForgotPassword(): void {
    this.forgotError = '';
    this.forgotSuccess = '';
    const email = this.forgotEmail?.trim() ?? '';
    if (!email) {
      this.forgotError = 'Ingresa tu correo electrónico.';
      return;
    }
    if (!AdminLoginComponent.EMAIL_REGEX.test(email)) {
      this.forgotError = 'El correo no tiene un formato válido. Ejemplo: nombre@correo.com';
      return;
    }
    this.forgotLoading = true;
    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.forgotLoading = false;
          this.forgotSuccess = 'Si el correo está registrado, recibirás un email con una contraseña temporal y un enlace para cambiarla. Revisa también la carpeta de spam.';
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.forgotLoading = false;
          this.forgotError = clientFacingHttpMessage(
            err,
            'No se pudo completar la solicitud. Intenta más tarde.'
          );
          this.cdr.detectChanges();
        });
      },
    });
  }

  openForgotModal(): void {
    this.forgotError = '';
    this.forgotSuccess = '';
    this.showForgotPassword = true;
  }

  closeForgotModal(): void {
    this.showForgotPassword = false;
    this.forgotSuccess = '';
    this.forgotError = '';
    this.forgotEmail = '';
  }

  /** true si el correo tiene formato válido (algo@dominio.ext) */
  get isForgotEmailValid(): boolean {
    const e = this.forgotEmail?.trim() ?? '';
    return e.length > 0 && AdminLoginComponent.EMAIL_REGEX.test(e);
  }
}

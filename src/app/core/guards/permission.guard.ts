import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function permissionGuard(permission: string): boolean {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    router.navigate(['/admin-login']);
    return false;
  }
  if (auth.hasPermission(permission)) return true;
  router.navigate(['/admin/dashboard']);
  return false;
}

/**
 * Fábrica de guards por permiso, para usar en la definición de rutas.
 * Materializa el control de acceso basado en roles (RBAC) también a nivel
 * de navegación del cliente, complementando la validación del backend.
 *
 * Uso: `canActivate: [requirePermission('manage_products')]`
 */
export const requirePermission =
  (permission: string): CanActivateFn =>
  () =>
    permissionGuard(permission);

/**
 * Restringe rutas a uno o más roles (p. ej. tablero gerencial: admin/gerente).
 */
export const requireAnyRole =
  (roles: readonly string[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      router.navigate(['/admin-login']);
      return false;
    }
    const role = auth.currentUser()?.role;
    if (role && roles.includes(role)) return true;
    router.navigate(['/admin/dashboard']);
    return false;
  };

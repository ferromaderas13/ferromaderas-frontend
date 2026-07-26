import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  SecurityControl,
  SecurityOverview,
  SecurityService,
} from '../../../core/services/security.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-security-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './security-admin.component.html',
  styleUrl: './security-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityAdminComponent implements OnInit {
  private readonly security = inject(SecurityService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  overview: SecurityOverview | null = null;
  loading = true;
  error = false;

  readonly roleLabels: Record<string, string> = {
    administrador: 'Administrador',
    gerente: 'Gerente',
    editor: 'Editor',
    vendedor: 'Vendedor',
  };

  ngOnInit(): void {
    this.security.getOverview().subscribe({
      next: (data) => {
        this.overview = data;
        this.loading = false;
        this.error = !data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = true;
        this.cdr.markForCheck();
      },
    });
  }

  roleLabel(slug: string, fallback?: string): string {
    return this.roleLabels[slug] || fallback || slug;
  }

  estadoLabel(estado: SecurityControl['estado']): string {
    const map: Record<SecurityControl['estado'], string> = {
      activo: 'Implementado',
      pendiente: 'Pendiente en producción',
      desarrollo: 'Desarrollo (HTTP local)',
    };
    return map[estado];
  }

  hasPermission(role: { permissions: string[] }, slug: string): boolean {
    return role.permissions.includes(slug);
  }

  currentUserName(): string {
    return this.auth.currentUser()?.name ?? '—';
  }
}

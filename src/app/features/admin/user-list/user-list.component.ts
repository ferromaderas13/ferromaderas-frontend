import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification.service';
import { clientFacingHttpMessage } from '../../../core/http/client-facing-error';
import { finalize } from 'rxjs';
import {
  UsersService,
  type ListUser,
  type UserRole,
  type UserStatus,
} from '../../../core/services/users.service';

/** Convierte ISO string (UTC) a hora de Guatemala (America/Guatemala, UTC-6) */
function formatGuatemalaTime(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-GT', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Guatemala',
    }).format(date);
  } catch {
    return isoString;
  }
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  searchTerm = '';
  filterRol: UserRole | '' = '';
  filterEstado: UserStatus | '' = '';
  users: ListUser[] = [];
  loading = true;

  viewModalUser: ListUser | null = null;

  constructor(
    private router: Router,
    private notification: NotificationService,
    private usersService: UsersService,
    private cdr: ChangeDetectorRef
  ) {}

  roles: { value: UserRole | ''; label: string }[] = [
    { value: '', label: 'Rol' },
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'gerente', label: 'Gerente' },
    { value: 'editor', label: 'Editor' },
    { value: 'administrador', label: 'Administrador' },
  ];

  statusOptions: { value: UserStatus | ''; label: string }[] = [
    { value: '', label: 'Estado' },
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
  ];

  private filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Diferir carga para asegurar que auth y vista estén listos (evita que se quede en "Cargando...")
    setTimeout(() => this.loadUsers(), 0);
  }

  onFilterChange(): void {
    if (this.filterDebounceTimer) clearTimeout(this.filterDebounceTimer);
    this.filterDebounceTimer = setTimeout(() => this.loadUsers(), 300);
  }

  loadUsers(): void {
    this.loading = true;
    this.usersService
      .list({
        search: this.searchTerm?.trim() || undefined,
        rol: this.filterRol || undefined,
        estado: this.filterEstado || undefined,
      })
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.users = data;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.notification.showMessage(
            clientFacingHttpMessage(err, 'No se pudieron cargar los usuarios.'),
            'error'
          );
        },
      });
  }

  /** Formatea último acceso en hora Guatemala */
  formatUltimoAcceso(iso: string | null): string {
    return formatGuatemalaTime(iso);
  }

  viewUser(user: ListUser): void {
    this.viewModalUser = user;
  }

  closeViewModal(): void {
    this.viewModalUser = null;
  }

  editUser(user: ListUser): void {
    this.router.navigate(['/admin/usuarios/crear'], {
      state: {
        editingUser: {
          id: user.id,
          nombre: user.nombre,
          username: user.username,
          email: user.email,
          phone: user.phone,
          rol: user.rol,
          estado: user.estado,
        },
      },
    });
  }

  resetPassword(user: ListUser): void {
    this.notification
      .confirm(
        'Restablecer contraseña',
        `Se enviará una contraseña temporal a ${user.email || user.username} y deberá cambiarla al entrar. ¿Continuar?`,
      )
      .then((ok) => {
        if (!ok) return;
        this.usersService.resetPassword(user.id).subscribe({
          next: (res) => {
            this.notification.showMessage(
              res.message || `Se envió una contraseña temporal a ${user.email}.`,
              'success',
            );
          },
          error: (err) =>
            this.notification.showMessage(
              clientFacingHttpMessage(err, 'No se pudo restablecer la contraseña.'),
              'error',
            ),
        });
      });
  }

  toggleEstado(user: ListUser): void {
    const accion = user.estado === 'activo' ? 'desactivar' : 'activar';
    this.notification
      .confirm('Confirmar', `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${user.nombre}?`)
      .then((ok) => {
        if (!ok) return;
        const newStatus = user.estado === 'activo' ? 'inactivo' : 'activo';
        this.usersService.update(user.id, { status: newStatus }).subscribe({
          next: () => {
            user.estado = newStatus;
            this.notification.showMessage(
              `Estado de ${user.nombre} actualizado.`,
              'success'
            );
          },
          error: (err) =>
            this.notification.showMessage(
              clientFacingHttpMessage(err, 'No se pudo actualizar el usuario.'),
              'error'
            ),
        });
      });
  }

  rolLabel(rol: UserRole): string {
    const labels: Record<UserRole, string> = {
      vendedor: 'Vendedor',
      administrador: 'Administrador',
      gerente: 'Gerente',
      editor: 'Editor',
    };
    return labels[rol] ?? rol;
  }

  userTrackBy(_index: number, user: ListUser): string {
    return user.id;
  }
}

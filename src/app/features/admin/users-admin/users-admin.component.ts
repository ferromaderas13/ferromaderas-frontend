import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { clientFacingHttpMessage } from '../../../core/http/client-facing-error';
import { UsersService } from '../../../core/services/users.service';
import { StorageApiService } from '../../../core/services/storage-api.service';
import { AuthService } from '../../../core/services/auth.service';

export type UserRole = 'vendedor' | 'administrador' | 'gerente' | 'editor';

export interface RolePermission {
  label: string;
  allowed: boolean;
}

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-admin.component.html',
  styleUrl: './users-admin.component.scss',
})
export class UsersAdminComponent {
  fullName = '';
  username = '';
  email = '';
  phone = '';
  role: UserRole = 'vendedor';
  status: 'activo' | 'inactivo' = 'activo';
  profileImage: string | null = null;
  temporaryPassword = '';
  showPassword = false;
  isEditingUser = false;
  editingUserId: string | null = null;
  saving = false;
  private selectedFile: File | null = null;

  roles: { value: UserRole; label: string }[] = [
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'gerente', label: 'Gerente' },
    { value: 'editor', label: 'Editor' },
    { value: 'administrador', label: 'Administrador' },
  ];

  statusOptions: { value: 'activo' | 'inactivo'; label: string }[] = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
  ];

  /** Permisos por rol para la sección "Permisos visibles" */
  vendedorPermissions: RolePermission[] = [
    { label: 'Gestionar productos', allowed: false },
    { label: 'Gestionar categorías', allowed: false },
    { label: 'Gestionar destacados', allowed: false },
    { label: 'Ver cotizaciones y cambiar estado', allowed: true },
    { label: 'Gestionar políticas de compra', allowed: false },
    { label: 'Crear usuarios / Resetear contraseñas', allowed: false },
  ];

  gerentePermissions: RolePermission[] = [
    { label: 'Gestionar productos', allowed: true },
    { label: 'Gestionar categorías', allowed: true },
    { label: 'Gestionar destacados', allowed: true },
    { label: 'Ver cotizaciones y cambiar estado', allowed: true },
    { label: 'Gestionar políticas de compra', allowed: true },
    { label: 'Crear usuarios / Resetear contraseñas', allowed: false },
  ];

  editorPermissions: RolePermission[] = [
    { label: 'Gestionar productos', allowed: false },
    { label: 'Gestionar categorías', allowed: false },
    { label: 'Gestionar destacados', allowed: true },
    { label: 'Ver cotizaciones y cambiar estado', allowed: true },
    { label: 'Gestionar políticas de compra', allowed: true },
    { label: 'Crear usuarios / Resetear contraseñas', allowed: false },
  ];

  adminPermissions: RolePermission[] = [
    { label: 'Gestionar productos', allowed: true },
    { label: 'Gestionar categorías', allowed: true },
    { label: 'Gestionar destacados', allowed: true },
    { label: 'Ver cotizaciones y cambiar estado', allowed: true },
    { label: 'Gestionar políticas de compra', allowed: true },
    { label: 'Crear usuarios / Resetear contraseñas', allowed: true },
  ];

  constructor(
    private router: Router,
    private notification: NotificationService,
    private usersService: UsersService,
    private storageApi: StorageApiService,
    private auth: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    const navState = this.router.getCurrentNavigation()?.extras?.state as {
      editingUser?: {
        id: string;
        nombre: string;
        username: string;
        email?: string;
        phone?: string;
        rol: UserRole;
        estado: 'activo' | 'inactivo';
        profileImage?: string | null;
      };
    } | undefined;
    const histState =
      typeof history !== 'undefined'
        ? (history.state as typeof navState)
        : undefined;
    const editingUser = navState?.editingUser ?? histState?.editingUser;
    if (editingUser) {
      const u = editingUser;
      this.isEditingUser = true;
      this.editingUserId = u.id;
      this.fullName = u.nombre;
      this.username = u.username;
      this.email = u.email ?? '';
      this.phone = this.parsePhoneForInput(u.phone);
      this.role = u.rol;
      this.status = u.estado;
      this.profileImage = u.profileImage ?? null;
    }
  }

  /** Extrae solo el número del teléfono (sin +502) para mostrar en el input */
  private parsePhoneForInput(phone?: string): string {
    if (!phone?.trim()) return '';
    return phone.replace(/^\+502\s*/, '').trim();
  }

  /** Solo permite: minúsculas, números, guión bajo, punto, guión. Estándar para usernames. */
  sanitizeUsername(value: string): string {
    return (value ?? '').toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  }

  /** Solo dígitos para guardar en BD. El +502 se muestra en el input, no se guarda. */
  get phoneForApi(): string {
    return (this.phone ?? '').replace(/\D/g, '');
  }

  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !input.files[0]) return;
    const file = input.files[0];
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      this.notification.showMessage('Solo se permiten imágenes .jpg, .jpeg o .png', 'error');
      input.value = '';
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.notification.showMessage('La imagen es demasiado grande. Máximo 5MB.', 'error');
      input.value = '';
      return;
    }
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result as string | undefined;
      this.ngZone.run(() => {
        this.profileImage = result ?? null;
        this.cdr.detectChanges();
        if (result) {
          this.notification.showMessage('Imagen seleccionada correctamente', 'success');
        }
      });
    };
    reader.readAsDataURL(file);
  }

  generatePassword(): void {
    const length = 12;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < length; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.temporaryPassword = pass;
  }

  copyPassword(): void {
    if (!this.temporaryPassword) return;
    navigator.clipboard.writeText(this.temporaryPassword).then(() => {
      // Opcional: toast o mensaje "Copiado"
    });
  }

  regeneratePassword(): void {
    this.generatePassword();
  }

  save(): void {
    if (this.saving) return;
    if (!this.fullName?.trim()) {
      this.notification.showMessage('El nombre completo es requerido.', 'error');
      return;
    }
    if (!this.username?.trim()) {
      this.notification.showMessage('El usuario es requerido.', 'error');
      return;
    }
    if (!this.isEditingUser) {
      if (!this.email?.trim()) {
        this.notification.showMessage('El correo es requerido.', 'error');
        return;
      }
      if (!this.temporaryPassword) {
        this.notification.showMessage(
          'Genere una contraseña temporal antes de guardar.',
          'error'
        );
        return;
      }
    }

    if (this.selectedFile) {
      this.saving = true;
      this.storageApi.upload(this.selectedFile, 'avatars').subscribe({
        next: (res) => {
          this.selectedFile = null;
          this.profileImage = res.url;
          this.persistUser(res.url);
        },
        error: (err) => {
          this.saving = false;
          this.notification.showMessage(
            clientFacingHttpMessage(err, 'No se pudo subir la imagen de perfil.'),
            'error',
          );
        },
      });
      return;
    }

    this.persistUser();
  }

  private persistUser(uploadedUrl?: string): void {
    this.saving = true;
    const profileImage = uploadedUrl ?? undefined;

    if (this.isEditingUser) {
      this.usersService
        .update(this.editingUserId!, {
          name: this.fullName,
          email: this.email?.trim() || undefined,
          phone: this.phoneForApi || undefined,
          role: this.role,
          status: this.status,
          ...(profileImage ? { profileImage } : {}),
        })
        .subscribe({
          next: () => this.afterSaved('Usuario actualizado.'),
          error: (err) => {
            this.saving = false;
            this.notification.showMessage(
              clientFacingHttpMessage(err, 'No se pudo actualizar el usuario.'),
              'error'
            );
          },
        });
      return;
    }

    this.usersService
      .create({
        username: this.username.trim(),
        email: this.email.trim(),
        password: this.temporaryPassword,
        name: this.fullName.trim(),
        phone: this.phoneForApi || undefined,
        role: this.role,
        status: this.status,
        ...(profileImage ? { profileImage } : {}),
      })
      .subscribe({
        next: () => this.afterSaved('Usuario creado.'),
        error: (err) => {
          this.saving = false;
          this.notification.showMessage(
            clientFacingHttpMessage(err, 'No se pudo crear el usuario.'),
            'error'
          );
        },
      });
  }

  private afterSaved(message: string): void {
    const finish = () => {
      this.saving = false;
      this.notification.showMessage(message, 'success');
      this.router.navigate(['/admin/usuarios']);
    };
    const me = this.auth.currentUser();
    if (this.isEditingUser && me?.id === this.editingUserId) {
      this.auth.refreshMe().subscribe({ next: () => finish(), error: () => finish() });
      return;
    }
    finish();
  }

  cancel(): void {
    this.router.navigate(['/admin/usuarios']);
  }
}

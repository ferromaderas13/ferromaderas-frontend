import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserRole = 'vendedor' | 'administrador' | 'gerente' | 'editor';
export type UserStatus = 'activo' | 'inactivo';

export interface ListUser {
  id: string;
  username: string;
  name: string;
  nombre: string;
  email: string;
  phone?: string;
  rol: UserRole;
  ultimoAcceso: string | null;
  estado: UserStatus;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  getRoles(): Observable<{ id: string; slug: string; name: string }[]> {
    return this.http.get<{ id: string; slug: string; name: string }[]>(
      `${this.api}/roles`
    );
  }

  list(filters?: {
    search?: string;
    rol?: string;
    estado?: string;
  }): Observable<ListUser[]> {
    const params: Record<string, string> = {};
    if (filters?.search) params['search'] = filters.search;
    if (filters?.rol) params['rol'] = filters.rol;
    if (filters?.estado) params['estado'] = filters.estado;
    return this.http.get<Omit<ListUser, 'nombre'>[]>(this.api, { params }).pipe(
      timeout(12000),
      map((users) =>
        users.map((u) => ({ ...u, nombre: u.name } as ListUser))
      )
    );
  }

  create(data: CreateUserDto): Observable<unknown> {
    return this.http.post(this.api, {
      username: data.username,
      email: data.email,
      password: data.password,
      name: data.name,
      phone: data.phone,
      role: data.role,
      status: data.status,
    });
  }

  resetPassword(id: string): Observable<{ ok: boolean; message: string }> {
    return this.http.post<{ ok: boolean; message: string }>(
      `${this.api}/${id}/reset-password`,
      {},
    );
  }

  update(
    id: string,
    data: { name?: string; email?: string; phone?: string; role?: string; status?: string }
  ): Observable<unknown> {
    return this.http.put(`${this.api}/${id}`, data);
  }

}

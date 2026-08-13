import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type StorageFolder = 'products' | 'categories' | 'avatars';

export interface StorageUploadResult {
  url: string;
  path: string;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class StorageApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/storage`;

  validate(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Formato no permitido. Solo .png, .jpg o .jpeg';
    }
    if (file.size > MAX_BYTES) {
      return 'La imagen es demasiado grande. Máximo 5 MB.';
    }
    return null;
  }

  /** Sube el archivo al API; Nest lo guarda en Supabase Storage y devuelve la URL pública. */
  upload(file: File, folder: StorageFolder): Observable<StorageUploadResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('folder', folder);
    return this.http.post<StorageUploadResult>(`${this.api}/upload`, body);
  }
}

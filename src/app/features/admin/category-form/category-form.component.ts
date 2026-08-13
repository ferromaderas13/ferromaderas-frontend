import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CatalogService } from '../../../core/services/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { StorageApiService } from '../../../core/services/storage-api.service';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
})
export class CategoryFormComponent implements OnInit, OnDestroy {
  isEditing = false;
  previewImage = '';
  private selectedFile: File | null = null;
  private previewObjectUrl: string | null = null;
  saving = false;
  categoryForm: Partial<Category> = {
    name: '',
    description: '',
    imageUrl: '',
    active: true,
  };

  constructor(
    private catalogService: CatalogService,
    private router: Router,
    private route: ActivatedRoute,
    private notification: NotificationService,
    private storageApi: StorageApiService,
  ) {}

  ngOnInit(): void {
    this.catalogService.loadCategories().subscribe(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        const category = this.catalogService.getCategoryById(id);
        if (category) {
          this.isEditing = true;
          this.categoryForm = { ...category };
          this.previewImage = category.imageUrl || '';
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  backToList(): void {
    this.router.navigate(['/admin/categorias']);
  }

  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !input.files[0]) return;
    const file = input.files[0];
    const error = this.storageApi.validate(file);
    if (error) {
      this.notification.showMessage(error, 'error');
      input.value = '';
      return;
    }
    this.revokePreviewUrl();
    this.selectedFile = file;
    this.previewObjectUrl = URL.createObjectURL(file);
    this.previewImage = this.previewObjectUrl;
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  saveCategory(): void {
    if (!this.categoryForm.name?.trim()) {
      this.notification.showMessage('El nombre de la categoría es requerido', 'error');
      return;
    }
    const persist = (imageUrl: string) => {
      const slug = this.catalogService.generateSlug(this.categoryForm.name!);
      if (this.isEditing && this.categoryForm.id) {
        this.catalogService
          .updateCategory(this.categoryForm.id, {
            name: this.categoryForm.name,
            slug,
            imageUrl,
            description: this.categoryForm.description,
          })
          .subscribe({
            next: () => {
              this.notification.showMessage('Categoría actualizada.', 'success');
              this.router.navigate(['/admin/categorias']);
            },
            error: () => this.notification.showMessage('Error al actualizar.', 'error'),
          });
      } else {
        this.catalogService
          .addCategory({
            name: this.categoryForm.name!,
            slug,
            imageUrl,
            description: this.categoryForm.description,
            active: this.categoryForm.active ?? true,
          } as Omit<Category, 'id'>)
          .subscribe({
            next: () => {
              this.notification.showMessage('Categoría creada.', 'success');
              this.router.navigate(['/admin/categorias']);
            },
            error: () => this.notification.showMessage('Error al crear.', 'error'),
          });
      }
    };

    if (this.selectedFile) {
      this.saving = true;
      this.storageApi.upload(this.selectedFile, 'categories').subscribe({
        next: (res) => {
          this.saving = false;
          this.selectedFile = null;
          persist(res.url);
        },
        error: (err: { error?: { message?: string } }) => {
          this.saving = false;
          this.notification.showMessage(
            err?.error?.message || 'No se pudo subir la imagen a Storage.',
            'error',
          );
        },
      });
      return;
    }

    persist(this.categoryForm.imageUrl || '');
  }
}

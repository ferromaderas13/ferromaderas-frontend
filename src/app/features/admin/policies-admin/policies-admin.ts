import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Policy, PolicyPage, PolicyService } from '../../../core/services/policy';
import { PolicyIconComponent } from '../../../shared/components/policy-icon/policy-icon.component';
import { NotificationService } from '../../../core/services/notification.service';
import { clientFacingHttpMessage } from '../../../core/http/client-facing-error';

@Component({
  selector: 'app-policies-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, PolicyIconComponent],
  templateUrl: './policies-admin.html',
  styleUrl: './policies-admin.scss',
})
export class PoliciesAdminComponent implements OnInit {
  private policyService = inject(PolicyService);
  private cdr = inject(ChangeDetectorRef);
  private notification = inject(NotificationService);

  public policyPage: PolicyPage = { title: '', subtitle: '', policies: [] };
  public hasUnsavedChanges = false;
  public isEditMode = false;
  private savedSnapshot: string = '';

  /** Array de políticas para el template (nunca undefined). */
  get policies(): Policy[] {
    return this.policyPage?.policies ?? [];
  }

  enterEditMode(): void {
    if (!this.policyPage.policies?.length) {
      this.policyPage = this.policyService.getPolicyPageSnapshot();
      if (!this.policyPage.policies?.length) {
        this.policyPage = this.policyService.getDefaultPolicyPage();
        this.policyService.updatePolicyPage(this.policyPage);
      }
    }
    this.isEditMode = true;
    this.cdr.detectChanges();
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  cancelEdit(): void {
    this.policyPage = JSON.parse(this.savedSnapshot);
    this.hasUnsavedChanges = false;
    this.isEditMode = false;
    this.cdr.detectChanges();
  }

  /** Carga las 6 políticas por defecto (por si no se cargaron al inicio). */
  loadDefaultPolicies(): void {
    this.policyPage = this.policyService.getDefaultPolicyPage();
    this.policyService.updatePolicyPage(this.policyPage).subscribe({
      next: () => {
        this.savedSnapshot = JSON.stringify(this.policyPage);
        this.hasUnsavedChanges = false;
        this.cdr.detectChanges();
        this.notification.showMessage('Políticas por defecto cargadas.', 'success');
      },
      error: (err) => {
        this.notification.showMessage(
          clientFacingHttpMessage(err, 'No se pudieron cargar las políticas por defecto.'),
          'error'
        );
      },
    });
  }

  ngOnInit(): void {
    this.policyService.loadPolicyPage().subscribe({
      next: (policyPage) => {
        this.policyPage = policyPage?.policies?.length
          ? JSON.parse(JSON.stringify(policyPage))
          : this.policyService.getDefaultPolicyPage();
        this.savedSnapshot = JSON.stringify(this.policyPage);
        this.hasUnsavedChanges = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.policyPage = this.policyService.getDefaultPolicyPage();
        this.savedSnapshot = JSON.stringify(this.policyPage);
        this.hasUnsavedChanges = false;
        this.cdr.detectChanges();
      },
    });
  }

  markDirty(): void {
    this.hasUnsavedChanges = true;
    this.cdr.markForCheck();
  }

  onSave(): void {
    const copy = JSON.parse(JSON.stringify(this.policyPage));
    this.policyService.updatePolicyPage(copy).subscribe({
      next: () => {
        this.savedSnapshot = JSON.stringify(copy);
        this.hasUnsavedChanges = false;
        this.cdr.markForCheck();
        this.notification.showMessage('Políticas guardadas. El sitio público se ha actualizado.', 'success');
      },
      error: (err) => {
        this.notification.showMessage(
          clientFacingHttpMessage(err, 'No se pudieron guardar las políticas.'),
          'error'
        );
      },
    });
  }

  showPreviewModal = false;

  goPreview(): void {
    // Muestra vista previa con los datos actuales del formulario (guardados o no)
    // Entorno controlado: no abre el sitio real, evita confusión con producción
    this.showPreviewModal = true;
    this.cdr.detectChanges();
  }

  closePreview(): void {
    this.showPreviewModal = false;
    this.cdr.detectChanges();
  }

  addContent(policy: Policy): void {
    policy.content.push('Nuevo contenido');
    this.markDirty();
  }

  /** Selecciona imagen para la política: solo JPG, JPEG o PNG. Convierte a data URL. */
  onPolicyImageSelect(policy: Policy, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      this.notification.showMessage('Solo se permiten imágenes JPG, JPEG o PNG.', 'error');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      policy.icon = reader.result as string;
      this.markDirty();
      input.value = '';
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  trackByFn(index: number): number {
    return index;
  }
}

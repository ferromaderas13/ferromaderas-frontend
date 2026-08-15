import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PolicyPage, PolicyService } from '../../../core/services/policy';
import { PolicyIconComponent } from '../../../shared/components/policy-icon/policy-icon.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule, PolicyIconComponent],
  templateUrl: './policies.component.html',
  styleUrl: './policies.component.scss'
})
export class PoliciesComponent implements OnInit, OnDestroy {
  private policyService = inject(PolicyService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  public policyPage: PolicyPage | null = null;

  ngOnInit(): void {
    this.policyService.loadPolicyPage()
      .pipe(takeUntil(this.destroy$))
      .subscribe(page => {
        this.policyPage = page;
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

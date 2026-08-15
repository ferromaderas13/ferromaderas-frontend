import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Policy } from '../../../core/services/policy';

type PolicyIconKey = 'price' | 'delivery' | 'returns' | 'stock' | 'payment' | 'schedule';

const KEYS: PolicyIconKey[] = ['price', 'delivery', 'returns', 'stock', 'payment', 'schedule'];

@Component({
  selector: 'app-policy-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './policy-icon.component.html',
  styleUrl: './policy-icon.component.scss',
})
export class PolicyIconComponent implements OnChanges {
  @Input({ required: true }) policy!: Policy;
  @Input() index = 0;

  customBroken = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['policy']) {
      this.customBroken = false;
    }
  }

  get hasCustomIcon(): boolean {
    const icon = (this.policy?.icon || '').trim();
    if (!icon || this.customBroken) return false;
    if (icon.includes('placeholder-')) return false;
    return true;
  }

  get key(): PolicyIconKey {
    const t = (this.policy?.title || '').toLowerCase();
    if (t.includes('precio')) return 'price';
    if (t.includes('envío') || t.includes('envio') || t.includes('flete')) return 'delivery';
    if (t.includes('cambio') || t.includes('devoluc')) return 'returns';
    if (t.includes('disponib') || t.includes('stock')) return 'stock';
    if (t.includes('pago')) return 'payment';
    if (t.includes('horario')) return 'schedule';
    return KEYS[this.index] ?? 'price';
  }

  onImgError(): void {
    this.customBroken = true;
  }
}

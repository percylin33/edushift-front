import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p class="text-xs font-medium uppercase tracking-wider text-slate-400">{{ label() }}</p>
      <p class="mt-1 text-3xl font-bold text-white">{{ formattedValue() }}</p>
      @if (subtitle()) {
        <p class="mt-1 text-xs text-slate-500">{{ subtitle() }}</p>
      }
    </div>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly format = input<'currency' | 'number'>('number');
  readonly subtitle = input<string>('');

  protected formattedValue(): string {
    if (this.format() === 'currency') {
      return 'S/ ' + this.value().toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return this.value().toLocaleString('es-PE');
  }
}

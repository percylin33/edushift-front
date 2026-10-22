import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-36 flex-col rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-black/10">
      <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{{ label() }}</p>
      <p class="mt-3 text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">{{ formattedValue() }}</p>
      @if (subtitle()) {
        <p class="mt-auto pt-3 text-xs leading-5 text-slate-400">{{ subtitle() }}</p>
      }
      @if (detail()) {
        <p class="mt-2 border-t border-slate-800 pt-2 text-xs font-medium text-amber-300">{{ detail() }}</p>
      }
    </div>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly format = input<'currency' | 'number'>('number');
  readonly subtitle = input<string>('');
  readonly detail = input<string>('');

  protected formattedValue(): string {
    if (this.format() === 'currency') {
      return 'S/ ' + this.value().toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return this.value().toLocaleString('es-PE');
  }
}

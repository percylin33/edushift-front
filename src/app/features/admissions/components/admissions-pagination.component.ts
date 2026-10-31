import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-admissions-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav
    aria-label="Páginas de resultados"
    class="flex items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm dark:border-slate-700"
  >
    <button
      type="button"
      [disabled]="page() === 0"
      (click)="changed.emit(page() - 1)"
      class="rounded-xl border px-3 py-2 disabled:opacity-40 dark:border-slate-700"
    >
      Anterior</button
    ><span>{{ total() }} resultados · Página {{ page() + 1 }} de {{ pages }}</span
    ><button
      type="button"
      [disabled]="page() + 1 >= pages"
      (click)="changed.emit(page() + 1)"
      class="rounded-xl border px-3 py-2 disabled:opacity-40 dark:border-slate-700"
    >
      Siguiente
    </button>
  </nav>`,
})
export class AdmissionsPaginationComponent {
  readonly page = input(0);
  readonly total = input(0);
  readonly size = input(20);
  readonly changed = output<number>();
  get pages(): number {
    return Math.max(1, Math.ceil(this.total() / this.size()));
  }
}

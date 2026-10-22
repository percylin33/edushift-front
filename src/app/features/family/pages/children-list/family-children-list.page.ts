import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FamilyChildSummary } from '../../models/family-child.model';
import { FamilyApiService } from '../../services/family-api.service';

@Component({
  selector: 'app-family-children-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Familia</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mis hijos</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">Consulta su progreso, asistencia y actividades desde un solo lugar.</p>
        </div>
        <a routerLink="/family/disclosures" class="inline-flex items-center justify-center rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40">Información anual del colegio</a>
      </header>

      @if (loading()) {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Cargando hijos">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">Reintentar</button>
        </div>
      } @else if (children().length === 0) {
        <div class="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Aún no hay hijos vinculados</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Contacta a la institución para completar la vinculación familiar.</p>
        </div>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (child of children(); track child.publicUuid) {
            <a [routerLink]="['/family/children', child.publicUuid]" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:ring-slate-800">
              <div class="flex items-center gap-4">
                <div class="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{{ initials(child) }}</div>
                <div>
                  <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ child.fullName }}</h2>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ child.enrollmentStatus }}</p>
                </div>
              </div>
              <p class="mt-6 text-sm font-semibold text-indigo-600">Ver resumen familiar</p>
            </a>
          }
        </div>
      }
    </section>
  `,
})
export class FamilyChildrenListPageComponent implements OnInit {
  private readonly api = inject(FamilyApiService);
  readonly children = signal<FamilyChildSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listChildren().subscribe({
      next: (response) => { this.children.set(response.data ?? []); this.loading.set(false); },
      error: () => { this.error.set('No se pudo cargar la información familiar.'); this.loading.set(false); },
    });
  }

  initials(child: FamilyChildSummary): string {
    return `${child.firstName[0] ?? ''}${child.lastName[0] ?? ''}`.toUpperCase();
  }
}

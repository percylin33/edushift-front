import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { MeSection, MeSectionPeriod } from '../../models/me-section.model';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-courses',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mis cursos</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          @if (viewingCurrentPeriod()) {
            Materias del periodo vigente, con tu docente y tu sección.
          } @else {
            Materias del bimestre seleccionado.
          }
        </p>

        @if (pastPeriods().length > 0) {
          <div class="mt-4 flex flex-wrap items-center gap-3">
            @if (!showPeriodPicker()) {
              <button
                type="button"
                class="text-sm font-semibold text-indigo-600 underline hover:text-indigo-700"
                (click)="openPeriodPicker()"
              >
                Ver bimestres anteriores
              </button>
            } @else {
              <label class="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
                <span class="font-semibold text-slate-700 dark:text-slate-300">Bimestre</span>
                <select
                  class="min-w-[12rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  [value]="selectedPeriodUuid() ?? ''"
                  (change)="onPeriodChange($event)"
                >
                  @for (period of periods(); track period.publicUuid) {
                    <option [value]="period.publicUuid">
                      {{ period.name }}{{ period.current ? ' (vigente)' : '' }}
                    </option>
                  }
                </select>
              </label>
              @if (!viewingCurrentPeriod()) {
                <button
                  type="button"
                  class="text-sm font-semibold text-indigo-600 underline hover:text-indigo-700"
                  (click)="selectCurrentPeriod()"
                >
                  Volver al periodo vigente
                </button>
              }
            }
          </div>
        }
      </header>

      @if (loading()) {
        <div class="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Cargando cursos">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (sections().length === 0) {
        <div
          class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            @if (viewingCurrentPeriod()) {
              Aún no hay cursos
            } @else {
              Sin cursos en este bimestre
            }
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            @if (viewingCurrentPeriod()) {
              Cuando el colegio te matricule en una sección, aparecerán aquí.
            } @else {
              Prueba otro bimestre o vuelve al periodo vigente.
            }
          </p>
        </div>
      } @else {
        <div class="mt-8 grid gap-4 sm:grid-cols-2">
          @for (section of sections(); track courseCardId(section)) {
            <a
              [routerLink]="['/me/courses', section.publicUuid]"
              [queryParams]="courseQuery(section)"
              class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-2 hover:ring-indigo-400 dark:bg-slate-900 dark:ring-slate-800"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Curso</p>
              <h2 class="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {{ section.courseName || 'Curso por asignar' }}
              </h2>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {{ section.gradeName || 'Grado' }}
                @if (section.name) {
                  <span> · Sección {{ section.name }}</span>
                }
              </p>
              @if (section.teacherName) {
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Docente: {{ section.teacherName }}
                </p>
              }
              @if (section.periodLabel) {
                <p class="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {{ section.periodLabel }}
                </p>
              }
              <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ver materiales, tareas y prácticas
              </p>
            </a>
          }
        </div>
      }
    </section>
  `,
})
export class MeCoursesPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sections = signal<MeSection[]>([]);
  readonly periods = signal<MeSectionPeriod[]>([]);
  readonly selectedPeriodUuid = signal<string | null>(null);
  readonly showPeriodPicker = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly pastPeriods = computed(() => this.periods().filter((p) => !p.current));
  readonly viewingCurrentPeriod = computed(() => {
    const selected = this.selectedPeriodUuid();
    if (!selected) {
      return true;
    }
    return this.periods().some((p) => p.publicUuid === selected && p.current);
  });

  ngOnInit(): void {
    this.load();
  }

  courseCardId(section: MeSection): string {
    return `${section.publicUuid}:${section.teacherAssignmentPublicUuid ?? ''}:${section.courseName ?? ''}`;
  }

  courseQuery(section: MeSection): { assignment: string } | Record<string, never> {
    return section.teacherAssignmentPublicUuid
      ? { assignment: section.teacherAssignmentPublicUuid }
      : {};
  }

  openPeriodPicker(): void {
    this.showPeriodPicker.set(true);
  }

  selectCurrentPeriod(): void {
    const current = this.periods().find((p) => p.current);
    this.selectedPeriodUuid.set(current?.publicUuid ?? null);
    this.loadSections(current?.publicUuid ?? null);
  }

  onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedPeriodUuid.set(value || null);
    this.loadSections(value || null);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      periods: this.api.listSectionPeriods(),
      sections: this.api.listSections(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ periods, sections }) => {
          const periodRows = periods.data ?? [];
          this.periods.set(periodRows);
          const current = periodRows.find((p) => p.current);
          this.selectedPeriodUuid.set(current?.publicUuid ?? null);
          this.sections.set(sections.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar tus cursos.');
          this.loading.set(false);
        },
      });
  }

  private loadSections(periodPublicUuid: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listSections(periodPublicUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.sections.set(response.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar tus cursos.');
          this.loading.set(false);
        },
      });
  }
}

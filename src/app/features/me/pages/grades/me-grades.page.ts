import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import {
  MeGradeCategorySummary,
  MeGradeCourseSummary,
  MeGradeSummaryItem,
  MeGradesSummary,
} from '../../models/me-grades-summary.model';
import { MeSectionPeriod } from '../../models/me-section.model';
import { MeApiService } from '../../services/me-api.service';

const KIND_LABELS: Record<string, string> = {
  TASK: 'Tareas',
  QUIZ: 'Pruebas',
  EXAM: 'Exámenes',
  RUBRIC: 'Rúbricas',
  COMPETENCY: 'Competencias',
};

@Component({
  selector: 'app-me-grades',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <a routerLink="/me/profile" class="font-medium hover:text-indigo-600">Mi espacio</a>
          <span aria-hidden="true">/</span>
          <span class="font-semibold text-slate-700 dark:text-slate-200">Calificaciones escolares</span>
        </div>
        @if (periods().length > 0) {
          <label class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <span class="text-slate-500">Periodo</span>
            <select
              data-testid="period-select"
              class="max-w-48 bg-transparent font-semibold text-slate-900 outline-none dark:text-slate-100"
              [value]="selectedPeriodUuid() ?? ''"
              (change)="onPeriodChange($event)"
            >
              @for (period of periods(); track period.publicUuid) {
                <option [value]="period.publicUuid">
                  {{ period.name }}{{ period.current ? ' (En curso)' : '' }}
                </option>
              }
            </select>
          </label>
        }
      </div>
      <header class="rounded-3xl bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6 ring-1 ring-indigo-100 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:ring-slate-800 sm:p-8">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Mi espacio académico</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Mis notas</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Seguimiento de tus calificaciones y competencias durante el periodo escolar.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando notas">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (courses().length === 0) {
        <div
          data-testid="empty-grades"
          class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sin calificaciones
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Cuando un docente publique una nota en este bimestre, aparecerá aquí.
          </p>
        </div>
      } @else {
        <div data-testid="summary-card" class="mt-5 grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          <div class="sm:col-span-2">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Consolidación del periodo</p>
            <p class="mt-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <span class="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
              Calificaciones en seguimiento
            </p>
            <p class="mt-1 text-sm text-slate-500">Consulta aquí las notas que tus docentes han registrado.</p>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio general</span>
              <span data-testid="overall-average" class="text-xl font-bold" [class.text-indigo-700]="hasOverall()" [class.text-slate-400]="!hasOverall()">{{ overallLabel() }}</span>
            </div>
          </div>
          <div class="border-slate-100 sm:border-l sm:pl-5 dark:border-slate-800">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Cursos evaluados</p>
            <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ summary()?.gradedCourseCount ?? 0 }} <span class="text-sm font-normal text-slate-400">de {{ summary()?.courseCount ?? courses().length }}</span></p>
          </div>
          <div class="border-slate-100 sm:border-l sm:pl-5 dark:border-slate-800">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Calificaciones registradas</p>
            <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ summary()?.gradedCount ?? 0 }}</p>
            @if (updatedAt()) {
              <p class="mt-1 text-xs text-slate-500">Último registro: {{ updatedAt() | date: 'dd/MM/yyyy HH:mm' }}</p>
            }
          </div>
        </div>

        <div class="mt-7">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Asignaturas</h2>
            <span class="text-sm text-slate-500">Selecciona una para revisar tus resultados</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          @for (course of courses(); track course.assignmentPublicUuid) {
            <button
              type="button"
              data-testid="course-card"
              class="min-h-32 rounded-2xl p-4 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md"
              [class.bg-indigo-50]="course.assignmentPublicUuid === selectedAssignmentUuid()"
              [class.text-slate-950]="course.assignmentPublicUuid === selectedAssignmentUuid()"
              [class.ring-indigo-300]="course.assignmentPublicUuid === selectedAssignmentUuid()"
              [class.bg-white]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              [class.text-slate-900]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              [class.ring-slate-200]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              [class.dark:bg-slate-900]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              [class.dark:ring-slate-800]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              (click)="selectCourse(course.assignmentPublicUuid)"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ course.sectionName || 'Sección' }}</p>
                <span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class.bg-indigo-100]="course.assignmentPublicUuid === selectedAssignmentUuid()" [class.text-indigo-700]="course.assignmentPublicUuid === selectedAssignmentUuid()" [class.bg-slate-100]="course.assignmentPublicUuid !== selectedAssignmentUuid()" [class.text-slate-500]="course.assignmentPublicUuid !== selectedAssignmentUuid()">{{ hasCourseResult(course) ? 'Con nota' : 'Sin nota' }}</span>
              </div>
              <p class="mt-4 font-bold">{{ course.courseName || 'Curso' }}</p>
              @if (course.teacherName) {
                <p class="mt-1 truncate text-xs text-slate-500">Prof. {{ course.teacherName }}</p>
              }
              <p class="mt-3 text-xl font-bold" [class.text-indigo-700]="hasCourseResult(course)" [class.text-slate-400]="!hasCourseResult(course)" data-testid="course-average">{{ courseResult(course) }}</p>
            </button>
          }
          </div>
        </div>

        @if (selectedCourse(); as course) {
          <article
            class="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-7"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                  <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {{ course.courseName || 'Curso' }}
                </h2>
                <p class="mt-1 text-sm text-slate-500">
                  {{ course.sectionName || 'Sección' }}
                  @if (course.teacherName) {
                    <span> · {{ course.teacherName }}</span>
                  }
                </p>
              </div>
              <div class="flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-3 dark:bg-indigo-950/50">
                <div class="text-right">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado del curso</p>
                  <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ hasCourseResult(course) ? 'Periodo actual' : 'En proceso' }}</p>
                </div>
                <p class="text-2xl font-bold" [class.text-indigo-700]="hasCourseResult(course)" [class.text-slate-400]="!hasCourseResult(course)">{{ courseResult(course) }}</p>
              </div>
            </div>
            @if (course.categories.length) {
              <div class="mt-7">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-xs font-bold uppercase tracking-wide text-slate-500">Estructura de evaluación del periodo</h3>
                  <span class="text-xs text-slate-500">{{ course.categories.length }} {{ course.categories.length === 1 ? 'componente' : 'componentes' }}</span>
                </div>
              <ul class="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="category-list">
                @for (category of course.categories; track category.publicUuid) {
                  <li class="rounded-xl bg-indigo-50/70 p-4 dark:bg-slate-800/80">
                    <div class="flex items-start justify-between gap-3 text-sm">
                    <span class="font-medium text-slate-700 dark:text-slate-200">
                      {{ category.name }}
                      @if (category.weight !== null && category.weight !== undefined) {
                        <span class="mt-1 block text-xs font-normal text-slate-500">Ponderación</span>
                      }
                    </span>
                    @if (category.weight !== null && category.weight !== undefined) {
                      <span class="rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-100">{{ weightLabel(category.weight) }}</span>
                    }
                    </div>
                    <div class="mt-3 flex items-center justify-between border-t border-indigo-100 pt-3 text-sm dark:border-slate-700">
                    <span class="text-slate-500">Calificación parcial</span>
                    <span
                      class="rounded-full bg-white px-2.5 py-1 font-bold text-indigo-700 dark:bg-slate-900 dark:text-indigo-300"
                      [class.text-slate-900]="hasCategoryResult(category)"
                      [class.dark:text-slate-100]="hasCategoryResult(category)"
                      [class.text-slate-400]="!hasCategoryResult(category)"
                    >
                      {{ categoryResult(category) }}
                    </span>
                    </div>
                  </li>
                }
              </ul>
              </div>
            }

            @if (kindOptions().length > 1) {
              <div class="mt-7 flex flex-wrap items-center justify-between gap-3" role="tablist" aria-label="Tipo de nota">
                <div class="flex flex-wrap gap-2">
                @for (kind of kindOptions(); track kind) {
                  <button
                    type="button"
                    class="rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm"
                    [class.bg-indigo-600]="kindFilter() === kind"
                    [class.text-white]="kindFilter() === kind"
                    [class.bg-slate-100]="kindFilter() !== kind"
                    [class.text-slate-700]="kindFilter() !== kind"
                    (click)="kindFilter.set(kind)"
                  >
                    {{ kindLabel(kind) }}
                  </button>
                }
                </div>
                @if (showCnebLegend()) {
                  <span class="text-xs text-slate-500">Escala de mérito: AD · A · B · C</span>
                }
              </div>
            }

            <div class="mt-4 grid gap-3">
              @for (item of visibleItems(); track item.publicUuid) {
                <div class="rounded-2xl bg-indigo-50/70 p-4 ring-1 ring-indigo-100 dark:bg-slate-800/70 dark:ring-slate-700 sm:p-5">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-semibold tracking-wide text-indigo-700 dark:text-indigo-300">
                        {{ itemKindLabel(item) }}
                        @if (item.weight !== null && item.weight !== undefined) {
                          <span> · Peso {{ weightLabel(item.weight) }}</span>
                        }
                        @if (item.scheduledDate) {
                          <span> · {{ item.scheduledDate | date: 'dd/MM/yyyy' }}</span>
                        }
                      </p>
                      <h3 class="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {{ item.evaluationName || 'Registro' }}
                      </h3>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="text-right">
                        <p class="text-xs font-semibold text-slate-500">{{ item.countsTowardAverage ? 'En promedio' : 'Registro' }}</p>
                        <p class="text-sm text-slate-500">{{ item.score !== null && item.score !== undefined ? 'Resultado' : 'Pendiente' }}</p>
                      </div>
                      <p class="rounded-xl bg-indigo-100 px-3 py-2 text-xl font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">{{ itemResult(item) }}</p>
                    </div>
                  </div>
                  @if (roleNote(item); as note) {
                    <p class="mt-2 text-xs text-slate-500">{{ note }}</p>
                  }
                  @if (item.comments) {
                    <blockquote class="mt-3 border-l-2 border-indigo-200 pl-3 text-sm text-slate-600 dark:text-slate-300">
                      {{ item.comments }}
                    </blockquote>
                  }
                </div>
              } @empty {
                <p class="text-sm text-slate-500">No hay notas de este tipo en el curso.</p>
              }
            </div>
          </article>
        }

        @if (showCnebLegend()) {
          <div
            data-testid="cneb-legend"
            class="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <span class="block font-semibold text-slate-900 dark:text-slate-100">Criterios de la escala CNEB</span>
            <span class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <span class="rounded-xl bg-teal-50 p-3 text-slate-700 dark:bg-teal-950/40 dark:text-slate-200"><b class="text-teal-700 dark:text-teal-300">AD · Destacado</b><span class="mt-1 block text-xs">Supera el nivel esperado de la competencia.</span></span>
              <span class="rounded-xl bg-blue-50 p-3 text-slate-700 dark:bg-blue-950/40 dark:text-slate-200"><b class="text-blue-700 dark:text-blue-300">A · Esperado</b><span class="mt-1 block text-xs">Alcanza satisfactoriamente el estándar previsto.</span></span>
              <span class="rounded-xl bg-indigo-50 p-3 text-slate-700 dark:bg-indigo-950/40 dark:text-slate-200"><b class="text-indigo-700 dark:text-indigo-300">B · En proceso</b><span class="mt-1 block text-xs">Avanza hacia el nivel requerido.</span></span>
              <span class="rounded-xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><b>C · En inicio</b><span class="mt-1 block text-xs">Requiere acompañamiento pedagógico.</span></span>
            </span>
            <span class="mt-3 block text-xs text-slate-500">Equivalencias de referencia: AD 4, A 3, B 2 y C 1.</span>
          </div>
        }
      }
    </section>
  `,
})
export class MeGradesPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly summary = signal<MeGradesSummary | null>(null);
  readonly periods = signal<MeSectionPeriod[]>([]);
  readonly selectedPeriodUuid = signal<string | null>(null);
  readonly selectedAssignmentUuid = signal<string | null>(null);
  readonly kindFilter = signal('ALL');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly courses = computed(() => this.summary()?.courses ?? []);
  readonly selectedCourse = computed(() =>
    this.courses().find((course) => course.assignmentPublicUuid === this.selectedAssignmentUuid())
      ?? null,
  );
  readonly courseItems = computed(() => {
    const assignment = this.selectedAssignmentUuid();
    if (!assignment) {
      return [];
    }
    return (this.summary()?.items ?? []).filter((item) => item.assignmentPublicUuid === assignment);
  });
  readonly kindOptions = computed(() => {
    const kinds = new Set<string>();
    for (const item of this.courseItems()) {
      if (item.kind) {
        kinds.add(item.kind);
      }
    }
    return ['ALL', ...kinds];
  });
  readonly visibleItems = computed(() => {
    const kind = this.kindFilter();
    if (kind === 'ALL') {
      return this.courseItems();
    }
    return this.courseItems().filter((item) => item.kind === kind);
  });
  readonly showCnebLegend = computed(() =>
    this.courses().some((course) => course.scale === 'LITERAL_CNEB'),
  );
  readonly updatedAt = computed(() => {
    const stamps = (this.summary()?.items ?? [])
      .map((item) => item.recordedAt)
      .filter((value): value is string => !!value)
      .sort();
    return stamps.length > 0 ? stamps[stamps.length - 1] : null;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      periods: this.api.listSectionPeriods(),
      summary: this.api.gradesSummary(this.selectedPeriodUuid()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ periods, summary }) => {
          const periodRows = periods.data ?? [];
          this.periods.set(periodRows);
          if (!this.selectedPeriodUuid()) {
            const current = periodRows.find((period) => period.current) ?? periodRows[0];
            this.selectedPeriodUuid.set(current?.publicUuid ?? null);
          }
          this.applySummary(summary.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar tus notas.');
          this.loading.set(false);
        },
      });
  }

  onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedPeriodUuid.set(value || null);
    this.selectedAssignmentUuid.set(null);
    this.kindFilter.set('ALL');
    this.load();
  }

  selectCourse(assignmentPublicUuid: string): void {
    this.selectedAssignmentUuid.set(assignmentPublicUuid);
    this.kindFilter.set('ALL');
  }

  hasOverall(): boolean {
    const average = this.summary()?.overallAverage;
    return average !== null && average !== undefined;
  }

  overallLabel(): string {
    if (!this.hasOverall()) {
      return 'Sin promedio';
    }
    return `${this.formatNumber(this.summary()!.overallAverage!)} / 20`;
  }

  hasCourseResult(course: MeGradeCourseSummary): boolean {
    return !!course.literalAverage || (course.average !== null && course.average !== undefined);
  }

  courseResult(course: MeGradeCourseSummary): string {
    if (course.literalAverage) {
      return course.literalAverage;
    }
    if (course.average === null || course.average === undefined) {
      return 'Sin nota';
    }
    return `${this.formatNumber(course.average)} / 20`;
  }

  hasCategoryResult(category: MeGradeCategorySummary): boolean {
    return !!category.literalAverage || (category.average !== null && category.average !== undefined);
  }

  categoryResult(category: MeGradeCategorySummary): string {
    if (category.literalAverage) {
      return category.literalAverage;
    }
    if (category.average === null || category.average === undefined) {
      return 'Sin nota';
    }
    return this.formatNumber(category.average);
  }

  kindLabel(kind: string): string {
    if (kind === 'ALL') {
      return 'Todas';
    }
    return KIND_LABELS[kind] ?? kind;
  }

  itemKindLabel(item: MeGradeSummaryItem): string {
    if (item.role === 'CLASSWORK') {
      return 'Tarea de clase';
    }
    return KIND_LABELS[item.kind ?? ''] ?? item.kind ?? 'Nota';
  }

  roleNote(item: MeGradeSummaryItem): string | null {
    if (item.role === 'EVIDENCE') {
      return 'Evidencia. Entra al promedio cuando el docente la registre en la libreta.';
    }
    if (item.role === 'CLASSWORK') {
      return 'Tarea de clase. Fuera de la libreta.';
    }
    return null;
  }

  itemResult(item: MeGradeSummaryItem): string {
    if (item.literal) {
      return item.literal;
    }
    if (item.score === null || item.score === undefined) {
      return '—';
    }
    if (item.maxScore !== null && item.maxScore !== undefined) {
      return `${this.formatNumber(item.score)}/${this.formatNumber(item.maxScore)}`;
    }
    return this.formatNumber(item.score);
  }

  weightLabel(weight: number): string {
    return `${this.formatNumber(weight)}%`;
  }

  private applySummary(summary: MeGradesSummary): void {
    this.summary.set(summary);
    const courses = summary?.courses ?? [];
    const current = this.selectedAssignmentUuid();
    const stillThere = courses.some((course) => course.assignmentPublicUuid === current);
    if (!stillThere) {
      this.selectedAssignmentUuid.set(courses[0]?.assignmentPublicUuid ?? null);
      this.kindFilter.set('ALL');
    }
  }

  private formatNumber(value: number): string {
    return Number(value).toLocaleString('es-PE', { maximumFractionDigits: 2 });
  }
}

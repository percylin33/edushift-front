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
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>
      <header class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
          <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mis notas</h1>
          <p class="mt-2 text-slate-600 dark:text-slate-400">
            Promedios del bimestre, con el mismo cálculo que ve tu docente.
          </p>
        </div>
        @if (periods().length > 0) {
          <label class="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
            <span class="font-semibold text-slate-700 dark:text-slate-300">Bimestre</span>
            <select
              data-testid="period-select"
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
        }
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
        <div
          data-testid="summary-card"
          class="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Promedio del bimestre
              </p>
              <p
                data-testid="overall-average"
                class="mt-1 text-4xl font-bold"
                [class.text-indigo-600]="hasOverall()"
                [class.text-slate-400]="!hasOverall()"
              >
                {{ overallLabel() }}
              </p>
            </div>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-slate-500">Cursos con nota</dt>
                <dd class="font-semibold text-slate-900 dark:text-slate-100">
                  {{ summary()?.gradedCourseCount ?? 0 }}
                </dd>
              </div>
              <div>
                <dt class="text-slate-500">Calificaciones</dt>
                <dd class="font-semibold text-slate-900 dark:text-slate-100">
                  {{ summary()?.gradedCount ?? 0 }}
                </dd>
              </div>
            </dl>
          </div>
          @if (updatedAt()) {
            <p class="mt-3 text-xs text-slate-500">
              Actualizado: {{ updatedAt() | date: 'dd/MM/yyyy HH:mm' }}
            </p>
          }
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (course of courses(); track course.assignmentPublicUuid) {
            <button
              type="button"
              data-testid="course-card"
              class="rounded-2xl p-4 text-left shadow-sm ring-1 transition"
              [class.bg-indigo-600]="course.assignmentPublicUuid === selectedAssignmentUuid()"
              [class.text-white]="course.assignmentPublicUuid === selectedAssignmentUuid()"
              [class.ring-indigo-600]="course.assignmentPublicUuid === selectedAssignmentUuid()"
              [class.bg-white]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              [class.ring-slate-200]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              [class.dark:bg-slate-900]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              [class.dark:ring-slate-800]="course.assignmentPublicUuid !== selectedAssignmentUuid()"
              (click)="selectCourse(course.assignmentPublicUuid)"
            >
              <p class="text-xs font-semibold uppercase tracking-wide opacity-70">
                {{ course.sectionName || 'Sección' }}
              </p>
              <p class="mt-1 font-semibold">{{ course.courseName || 'Curso' }}</p>
              <p
                class="mt-2 text-2xl font-bold"
                [class.text-white]="course.assignmentPublicUuid === selectedAssignmentUuid()"
                [class.text-indigo-600]="course.assignmentPublicUuid !== selectedAssignmentUuid() && hasCourseResult(course)"
                [class.text-slate-400]="course.assignmentPublicUuid !== selectedAssignmentUuid() && !hasCourseResult(course)"
                data-testid="course-average"
              >
                {{ courseResult(course) }}
              </p>
            </button>
          }
        </div>

        @if (selectedCourse(); as course) {
          <article
            class="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {{ course.courseName || 'Curso' }}
                </h2>
                <p class="mt-1 text-sm text-slate-500">
                  {{ course.sectionName || 'Sección' }}
                  @if (course.teacherName) {
                    <span> · {{ course.teacherName }}</span>
                  }
                </p>
              </div>
              <p
                class="text-2xl font-bold"
                [class.text-indigo-600]="hasCourseResult(course)"
                [class.text-slate-400]="!hasCourseResult(course)"
              >
                {{ courseResult(course) }}
              </p>
            </div>
            @if (course.categories.length) {
              <ul class="mt-4 grid gap-2" data-testid="category-list">
                @for (category of course.categories; track category.publicUuid) {
                  <li class="flex items-baseline justify-between gap-3 text-sm">
                    <span class="text-slate-600 dark:text-slate-300">
                      {{ category.name }}
                      @if (category.weight !== null && category.weight !== undefined) {
                        <span class="text-slate-400">· {{ weightLabel(category.weight) }}</span>
                      }
                    </span>
                    <span
                      class="font-semibold"
                      [class.text-slate-900]="hasCategoryResult(category)"
                      [class.dark:text-slate-100]="hasCategoryResult(category)"
                      [class.text-slate-400]="!hasCategoryResult(category)"
                    >
                      {{ categoryResult(category) }}
                    </span>
                  </li>
                }
              </ul>
            }

            @if (kindOptions().length > 1) {
              <div class="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Tipo de nota">
                @for (kind of kindOptions(); track kind) {
                  <button
                    type="button"
                    class="rounded-full px-3 py-1 text-sm font-semibold"
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
            }

            <div class="mt-4 grid gap-3">
              @for (item of visibleItems(); track item.publicUuid) {
                <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    <p class="text-xl font-bold text-indigo-600">{{ itemResult(item) }}</p>
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
          <p
            data-testid="cneb-legend"
            class="mt-6 text-xs text-slate-500"
          >
            Escala CNEB: AD desde 3.50 · A desde 2.50 · B desde 1.50 · C por debajo.
            Los puntos internos son AD 4, A 3, B 2 y C 1.
          </p>
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

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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { MeSection, MeSectionPeriod } from '../../models/me-section.model';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-courses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <a
          routerLink="/me/profile"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-700 dark:text-slate-300"
        >
          <span aria-hidden="true" class="text-lg">←</span>
          <span>Volver a Mi perfil</span>
        </a>
        @if (sections().length > 0) {
          <p class="text-sm text-slate-500 dark:text-slate-400">
            <span class="font-medium text-slate-700 dark:text-slate-200">Periodo:</span>
            {{ periodName() }}
          </p>
        }
      </div>

      @if (loading()) {
        <div
          class="mt-6 h-44 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"
          aria-label="Cargando cursos"
        ></div>
      } @else if (error()) {
        <div
          class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"
          role="alert"
        >
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else {
        <header
          class="mt-6 flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-6 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/60 sm:p-8 lg:flex-row lg:items-center"
        >
          <div class="max-w-3xl">
            <div
              class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300"
            >
              <span>Mi espacio escolar</span><span aria-hidden="true">•</span>
              <span
                class="rounded-md bg-blue-100 px-2.5 py-1 normal-case tracking-normal text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                >{{ periodName() }}</span
              >
            </div>
            <h1
              class="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
            >
              Mis cursos
            </h1>
            <p
              class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base"
            >
              @if (viewingCurrentPeriod()) {
                Tus materias, docentes y recursos del periodo vigente.
              } @else {
                Materias y recursos del periodo seleccionado.
              }
            </p>
          </div>
          <div
            class="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch"
          >
            <div
              class="flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-white dark:bg-slate-800 dark:ring-slate-700"
            >
              <span
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                aria-hidden="true"
                >▣</span
              >
              <div>
                <p class="font-semibold text-slate-900 dark:text-white">
                  {{ sections().length }}
                  {{ sections().length === 1 ? 'materia activa' : 'materias activas' }}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">En tu horario escolar</p>
              </div>
            </div>
            @if (periods().length > 1) {
              <label class="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                <span class="font-semibold">Cambiar periodo escolar</span>
                <select
                  id="course-period-selector"
                  class="min-w-[13rem] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  [ngModel]="selectedPeriodUuid() ?? ''"
                  (ngModelChange)="onPeriodChange($event)"
                >
                  @for (period of periods(); track period.publicUuid) {
                    <option [value]="period.publicUuid">
                      {{ period.name }}{{ period.current ? ' (vigente)' : '' }}
                    </option>
                  }
                </select>
                @if (loadingSections()) {
                  <span class="text-xs text-blue-700 dark:text-blue-300" role="status">
                    Cargando cursos del periodo…
                  </span>
                }
              </label>
            }
          </div>
        </header>

        @if (sections().length === 0) {
          <div
            class="mt-6 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"
          >
            <span
              class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              aria-hidden="true"
              >▣</span
            >
            <h2 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              {{ viewingCurrentPeriod() ? 'Aún no hay cursos' : 'Sin cursos en este bimestre' }}
            </h2>
            <p class="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              {{
                viewingCurrentPeriod()
                  ? 'Cuando el colegio te matricule en una sección, tus materias aparecerán aquí.'
                  : 'Prueba otro bimestre o vuelve al periodo vigente.'
              }}
            </p>
          </div>
        } @else {
          <div class="mt-5 grid gap-3 sm:grid-cols-3">
            <article
              class="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <span
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-xl text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
                aria-hidden="true"
                >▤</span
              >
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Tareas del periodo
                </p>
                <p class="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                  {{ totalTasks() }} {{ totalTasks() === 1 ? 'publicada' : 'publicadas' }}
                </p>
              </div>
            </article>
            <article
              class="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <span
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                aria-hidden="true"
                >▱</span
              >
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Materiales disponibles
                </p>
                <p class="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                  {{ totalMaterials() }} {{ totalMaterials() === 1 ? 'recurso' : 'recursos' }}
                </p>
              </div>
            </article>
            <article
              class="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <span
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                aria-hidden="true"
                >☷</span
              >
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Prácticas disponibles
                </p>
                <p class="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                  {{ totalQuizzes() }} {{ totalQuizzes() === 1 ? 'práctica' : 'prácticas' }}
                </p>
              </div>
            </article>
          </div>

          <div class="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              class="flex flex-wrap items-center gap-2 rounded-2xl bg-blue-50/80 p-1.5 dark:bg-slate-900"
            >
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-sm font-medium transition"
                [class.bg-white]="filterMode() === 'all'"
                [class.text-blue-700]="filterMode() === 'all'"
                [class.shadow-sm]="filterMode() === 'all'"
                [class.text-slate-600]="filterMode() !== 'all'"
                [attr.aria-pressed]="filterMode() === 'all'"
                (click)="filterMode.set('all')"
              >
                Todos los cursos ({{ sections().length }})
              </button>
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-sm font-medium transition"
                [class.bg-white]="filterMode() === 'tasks'"
                [class.text-blue-700]="filterMode() === 'tasks'"
                [class.shadow-sm]="filterMode() === 'tasks'"
                [class.text-slate-600]="filterMode() !== 'tasks'"
                [attr.aria-pressed]="filterMode() === 'tasks'"
                (click)="filterMode.set('tasks')"
              >
                Con tareas ({{ sectionsWithTasks() }})
              </button>
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-sm font-medium transition"
                [class.bg-white]="filterMode() === 'materials'"
                [class.text-blue-700]="filterMode() === 'materials'"
                [class.shadow-sm]="filterMode() === 'materials'"
                [class.text-slate-600]="filterMode() !== 'materials'"
                [attr.aria-pressed]="filterMode() === 'materials'"
                (click)="filterMode.set('materials')"
              >
                Con materiales ({{ sectionsWithMaterials() }})
              </button>
            </div>
            <label class="relative block w-full lg:max-w-sm">
              <span class="sr-only">Buscar materia o docente</span>
              <span
                class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
                aria-hidden="true"
                >⌕</span
              >
              <input
                type="search"
                class="w-full rounded-xl border-0 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                placeholder="Buscar materia o docente…"
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
              />
            </label>
          </div>

          @if (filteredSections().length === 0) {
            <div
              class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"
            >
              <h2 class="font-semibold text-slate-900 dark:text-white">
                No encontramos cursos con esos filtros
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                Prueba otra búsqueda o muestra todos tus cursos.
              </p>
              <button
                type="button"
                class="mt-3 text-sm font-semibold text-blue-700 underline dark:text-blue-300"
                (click)="clearFilters()"
              >
                Limpiar filtros
              </button>
            </div>
          } @else {
            <div class="mt-5 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              @for (
                section of filteredSections();
                track courseCardId(section);
                let index = $index
              ) {
                <a
                  [routerLink]="['/me/courses', section.publicUuid]"
                  [queryParams]="courseQuery(section)"
                  class="group flex min-h-[390px] flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-blue-700 sm:p-6"
                  [attr.aria-label]="'Ingresar al curso ' + (section.courseName || 'sin nombre')"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <span
                        class="inline-flex max-w-full truncate rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                        [ngClass]="courseTone(index)"
                        >{{ section.courseName || 'Curso' }}</span
                      >
                      <p
                        class="mt-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"
                      >
                        {{ section.gradeName || 'Grado' }} · Sección {{ section.name }}
                      </p>
                    </div>
                    <span
                      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
                      [ngClass]="courseTone(index)"
                      aria-hidden="true"
                      >{{ courseGlyph(index) }}</span
                    >
                  </div>

                  <h2 class="mt-5 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {{ section.courseName || 'Curso por asignar' }}
                  </h2>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {{ section.gradeLevelName || section.gradeName || 'Nivel escolar' }} · Sección
                    {{ section.name }}
                  </p>

                  <div
                    class="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70"
                  >
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      >{{ teacherInitials(section.teacherName) }}</span
                    >
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {{ section.teacherName || 'Docente por asignar' }}
                      </p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ section.gradeName || 'Aula' }} · {{ section.name }}
                      </p>
                    </div>
                  </div>

                  <div class="mt-4 flex flex-wrap gap-2">
                    @if (section.taskCount > 0) {
                      <span
                        class="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                        >{{ section.taskCount }}
                        {{
                          section.taskCount === 1 ? 'tarea publicada' : 'tareas publicadas'
                        }}</span
                      >
                    }
                    @if (section.materialCount > 0) {
                      <span
                        class="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                        >{{ section.materialCount }}
                        {{ section.materialCount === 1 ? 'material' : 'materiales' }}</span
                      >
                    }
                    @if (section.quizCount > 0) {
                      <span
                        class="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                        >{{ section.quizCount }}
                        {{ section.quizCount === 1 ? 'práctica' : 'prácticas' }}</span
                      >
                    }
                    @if (
                      section.taskCount === 0 &&
                      section.materialCount === 0 &&
                      section.quizCount === 0
                    ) {
                      <span
                        class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >Sin recursos publicados aún</span
                      >
                    }
                  </div>

                  @if (section.periodLabel) {
                    <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      {{ section.periodLabel }}
                    </p>
                  }

                  <div class="mt-auto pt-6 text-center">
                    <span
                      class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition group-hover:bg-blue-800"
                      >Ingresar al curso <span aria-hidden="true">→</span></span
                    >
                    <span class="mt-2 block text-xs font-medium text-slate-600 dark:text-slate-400"
                      >Ver tareas, prácticas y materiales</span
                    >
                  </div>
                </a>
              }
            </div>
          }

          @if (pastPeriods().length > 0) {
            <aside
              class="mt-6 flex flex-col gap-4 rounded-3xl bg-indigo-50/80 p-5 dark:bg-indigo-950/40 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div class="flex items-start gap-3">
                <span
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-indigo-700 dark:bg-slate-900 dark:text-indigo-300"
                  aria-hidden="true"
                  >▤</span
                >
                <div>
                  <h2 class="font-semibold text-slate-900 dark:text-white">
                    ¿Necesitas revisar un periodo anterior?
                  </h2>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Consulta las materias y recursos de tus bimestres anteriores.
                  </p>
                </div>
              </div>
              <span class="shrink-0 text-sm font-semibold text-blue-700 dark:text-blue-300">
                Usa el selector de periodo de la cabecera.
              </span>
            </aside>
          }
        }
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
  readonly searchQuery = signal('');
  readonly filterMode = signal<'all' | 'tasks' | 'materials'>('all');
  readonly loading = signal(true);
  readonly loadingSections = signal(false);
  readonly error = signal<string | null>(null);
  private sectionsRequestId = 0;

  readonly pastPeriods = computed(() => this.periods().filter((p) => !p.current));
  readonly periodName = computed(() => {
    const selected = this.periods().find(
      (period) => period.publicUuid === this.selectedPeriodUuid(),
    );
    return selected?.name ?? this.sections()[0]?.periodLabel ?? 'Periodo vigente';
  });
  readonly totalTasks = computed(() =>
    this.sections().reduce((total, section) => total + section.taskCount, 0),
  );
  readonly totalMaterials = computed(() =>
    this.sections().reduce((total, section) => total + section.materialCount, 0),
  );
  readonly totalQuizzes = computed(() =>
    this.sections().reduce((total, section) => total + section.quizCount, 0),
  );
  readonly sectionsWithTasks = computed(
    () => this.sections().filter((section) => section.taskCount > 0).length,
  );
  readonly sectionsWithMaterials = computed(
    () => this.sections().filter((section) => section.materialCount > 0).length,
  );
  readonly filteredSections = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('es');
    return this.sections().filter((section) => {
      const matchesMode =
        this.filterMode() === 'all' ||
        (this.filterMode() === 'tasks' && section.taskCount > 0) ||
        (this.filterMode() === 'materials' && section.materialCount > 0);
      const searchText = [
        section.courseName,
        section.teacherName,
        section.gradeName,
        section.gradeLevelName,
        section.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es');
      return matchesMode && (!query || searchText.includes(query));
    });
  });
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

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterMode.set('all');
  }

  teacherInitials(teacherName: string | null): string {
    const initials = (teacherName ?? 'ED')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('');
    return initials.toLocaleUpperCase('es') || 'ED';
  }

  courseTone(index: number): string {
    const tones = [
      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
      'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
      'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    ];
    return tones[index % tones.length];
  }

  courseGlyph(index: number): string {
    const glyphs = ['✎', '△', '✧', '♡', '✳'];
    return glyphs[index % glyphs.length];
  }

  onPeriodChange(value: string): void {
    this.selectedPeriodUuid.set(value || null);
    this.loadSections(value || null);
  }

  load(): void {
    this.sectionsRequestId += 1;
    this.loadingSections.set(false);
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
    const requestId = ++this.sectionsRequestId;
    this.loadingSections.set(true);
    this.error.set(null);
    this.api
      .listSections(periodPublicUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.sectionsRequestId) return;
          this.sections.set(response.data ?? []);
          this.loadingSections.set(false);
        },
        error: () => {
          if (requestId !== this.sectionsRequestId) return;
          this.error.set('No se pudieron cargar tus cursos.');
          this.loadingSections.set(false);
        },
      });
  }
}

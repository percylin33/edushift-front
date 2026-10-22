import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ROUTES } from '@core/constants';
import { MeSectionDetail, MeMaterialItem } from '../../models/me-section.model';
import { MeApiService } from '../../services/me-api.service';
import { FileUploadService } from '@core/services/file-upload.service';
import { FilePreviewDialogComponent } from '@shared/components';

@Component({
  selector: 'app-me-course-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FilePreviewDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <a
          routerLink="/me/courses"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-700 dark:text-slate-300"
        >
          <span aria-hidden="true" class="text-lg">←</span> Volver a Mis cursos
        </a>
        @if (detail(); as d) {
          <div class="flex items-center gap-2 text-sm">
            @if (d.academicYearLabel) {
              <span
                class="rounded-lg bg-white px-3 py-2 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                >Periodo escolar {{ d.academicYearLabel }}</span
              >
            }
            @if (d.gradeLevelName || d.gradeName) {
              <span
                class="rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >{{ d.gradeLevelName || d.gradeName }}</span
              >
            }
          </div>
        }
      </div>

      @if (loading()) {
        <div
          class="mt-6 h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"
          aria-label="Cargando curso"
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
        @if (detail(); as d) {
          <header
            class="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-7"
          >
            <div class="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div>
                <div
                  class="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
                >
                  <span
                    class="rounded-md bg-blue-50 px-2.5 py-1 font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    >{{ d.courseName || 'Curso' }}</span
                  >
                  <span aria-hidden="true">•</span
                  ><span>{{ d.gradeName || 'Grado' }} · Sección {{ d.name }}</span>
                  @if (d.periodLabel) {
                    <span aria-hidden="true">•</span><span>{{ d.periodLabel }}</span>
                  }
                </div>
                <h1
                  class="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
                >
                  {{ d.courseName || 'Mi curso' }}
                </h1>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {{ d.gradeName || 'Grado' }} <span aria-hidden="true">·</span> Sección
                  {{ d.name }}
                  @if (d.teacherName) {
                    <span aria-hidden="true">·</span> Docente:
                    <span class="font-medium text-slate-800 dark:text-slate-200">{{
                      d.teacherName
                    }}</span>
                  }
                </p>
              </div>
              <div
                class="grid grid-cols-3 divide-x divide-slate-200 rounded-2xl bg-slate-50 p-4 dark:divide-slate-700 dark:bg-slate-800/60 xl:min-w-[420px]"
              >
                <div class="px-3">
                  <p class="text-xs text-slate-500 dark:text-slate-400">Tareas</p>
                  <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {{ d.tasks.length }}
                  </p>
                  <p class="text-xs text-slate-500">publicadas</p>
                </div>
                <div class="px-3">
                  <p class="text-xs text-slate-500 dark:text-slate-400">Prácticas</p>
                  <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {{ d.quizzes.length }}
                  </p>
                  <p class="text-xs text-slate-500">disponibles</p>
                </div>
                <div class="px-3">
                  <p class="text-xs text-slate-500 dark:text-slate-400">Materiales</p>
                  <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {{ d.materials.length }}
                  </p>
                  <p class="text-xs text-slate-500">del curso</p>
                </div>
              </div>
            </div>
          </header>

          <div class="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div class="min-w-0">
              <nav
                class="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700"
                aria-label="Contenido del curso"
              >
                <button
                  type="button"
                  (click)="activeTab.set('tasks')"
                  [attr.aria-current]="activeTab() === 'tasks' ? 'page' : null"
                  [class.border-blue-600]="activeTab() === 'tasks'"
                  [class.bg-slate-900]="activeTab() === 'tasks'"
                  [class.text-white]="activeTab() === 'tasks'"
                  class="mb-2 inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  <span aria-hidden="true">▤</span> Tareas ({{ d.tasks.length }})
                </button>
                <button
                  type="button"
                  (click)="activeTab.set('quizzes')"
                  [attr.aria-current]="activeTab() === 'quizzes' ? 'page' : null"
                  [class.border-blue-600]="activeTab() === 'quizzes'"
                  [class.bg-slate-900]="activeTab() === 'quizzes'"
                  [class.text-white]="activeTab() === 'quizzes'"
                  class="mb-2 inline-flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  <span aria-hidden="true">☷</span> Prácticas ({{ d.quizzes.length }})
                </button>
                <button
                  type="button"
                  (click)="activeTab.set('materials')"
                  [attr.aria-current]="activeTab() === 'materials' ? 'page' : null"
                  [class.border-blue-600]="activeTab() === 'materials'"
                  [class.bg-slate-900]="activeTab() === 'materials'"
                  [class.text-white]="activeTab() === 'materials'"
                  class="mb-2 inline-flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  <span aria-hidden="true">▱</span> Materiales ({{ d.materials.length }})
                </button>
              </nav>

              @if (activeTab() === 'tasks') {
                <div class="mt-6 flex items-center justify-between gap-3">
                  <h2 class="text-lg font-bold text-slate-900 dark:text-white">Tareas del curso</h2>
                  <span class="text-sm text-slate-500">{{ d.tasks.length }} publicadas</span>
                </div>
                @if (d.tasks.length === 0) {
                  <div
                    class="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p class="font-semibold text-slate-800 dark:text-slate-200">
                      No hay tareas publicadas
                    </p>
                    <p class="mt-1 text-sm text-slate-500">
                      Cuando tu docente comparta una tarea, la verás aquí.
                    </p>
                  </div>
                }
                <ul class="mt-4 grid gap-4">
                  @for (task of d.tasks; track task.publicUuid) {
                    <li
                      class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                    >
                      <div
                        class="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"
                      >
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            @if (task.overdue) {
                              <span
                                class="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                >Plazo vencido</span
                              >
                            } @else if (task.dueAt) {
                              <span
                                class="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                >Entrega próxima</span
                              >
                            } @else {
                              <span
                                class="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                >Sin fecha límite</span
                              >
                            }
                            @if (task.hasAttachment) {
                              <span
                                class="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                >Incluye archivo</span
                              >
                            }
                          </div>
                          <h3 class="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
                            {{ task.title }}
                          </h3>
                          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            {{
                              task.dueAt
                                ? 'Fecha límite: ' + (task.dueAt | date: 'dd/MM/yyyy, h:mm a')
                                : 'Revisa las indicaciones de tu docente al abrir la tarea.'
                            }}
                          </p>
                        </div>
                        <a
                          [routerLink]="taskDetailLink(task.publicUuid)"
                          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          [attr.aria-label]="'Ver tarea ' + task.title"
                          ><span aria-hidden="true">◉</span> Ver tarea</a
                        >
                      </div>
                    </li>
                  }
                </ul>
              } @else if (activeTab() === 'quizzes') {
                <div class="mt-6 flex items-center justify-between gap-3">
                  <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                    Prácticas del curso
                  </h2>
                  <span class="text-sm text-slate-500">{{ d.quizzes.length }} disponibles</span>
                </div>
                @if (d.quizzes.length === 0) {
                  <div
                    class="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p class="font-semibold text-slate-800 dark:text-slate-200">
                      No hay prácticas publicadas
                    </p>
                    <p class="mt-1 text-sm text-slate-500">
                      Las prácticas aparecerán aquí cuando estén disponibles.
                    </p>
                  </div>
                }
                <ul class="mt-4 grid gap-3">
                  @for (quiz of d.quizzes; track quiz.publicUuid) {
                    <li
                      class="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span class="text-xs font-medium uppercase tracking-wide text-blue-700">{{
                          quiz.status
                        }}</span>
                        <h3 class="mt-1 font-semibold text-slate-900 dark:text-white">
                          {{ quiz.title }}
                        </h3>
                        <p class="mt-1 text-sm text-slate-500">
                          {{ quiz.questionCount }} preguntas
                          @if (quiz.timeLimitMinutes) {
                            · {{ quiz.timeLimitMinutes }} min
                          }
                          @if (quiz.dueAt) {
                            · Hasta {{ quiz.dueAt | date: 'dd/MM/yyyy' }}
                          }
                        </p>
                      </div>
                      <a
                        [routerLink]="takeLink(quiz.publicUuid)"
                        class="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
                        >Abrir práctica</a
                      >
                    </li>
                  }
                </ul>
              } @else {
                <div class="mt-6 flex items-center justify-between gap-3">
                  <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                    Materiales del curso
                  </h2>
                  <span class="text-sm text-slate-500">{{ d.materials.length }} recursos</span>
                </div>
                @if (d.materials.length === 0) {
                  <div
                    class="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p class="font-semibold text-slate-800 dark:text-slate-200">
                      Aún no hay materiales
                    </p>
                    <p class="mt-1 text-sm text-slate-500">
                      Los recursos compartidos por tu docente aparecerán aquí.
                    </p>
                  </div>
                }
                <ul class="mt-4 grid gap-3">
                  @for (material of d.materials; track material.publicUuid) {
                    <li
                      class="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div class="min-w-0">
                        <p class="font-semibold text-slate-900 dark:text-white">
                          {{ material.title }}
                        </p>
                        <p class="mt-1 text-sm text-slate-500">
                          {{ materialKindLabel(material) }}
                          @if (material.filename) {
                            · {{ material.filename }}
                          }
                        </p>
                      </div>
                      @if (material.externalUrl) {
                        <a
                          [href]="material.externalUrl"
                          target="_blank"
                          rel="noopener"
                          class="text-sm font-semibold text-blue-700 hover:underline"
                          >Abrir enlace</a
                        >
                      } @else if (material.filePublicUuid) {
                        <div class="flex flex-wrap gap-4">
                          <button
                            type="button"
                            class="text-sm font-semibold text-blue-700 hover:underline"
                            (click)="onPreviewMaterial(material)"
                          >
                            Ver documento</button
                          ><button
                            type="button"
                            class="text-sm font-semibold text-blue-700 disabled:opacity-50"
                            [disabled]="downloadingMaterial() === material.publicUuid"
                            (click)="onDownloadMaterial(material)"
                          >
                            {{
                              downloadingMaterial() === material.publicUuid
                                ? 'Descargando…'
                                : 'Descargar'
                            }}
                          </button>
                        </div>
                      }
                    </li>
                  }
                </ul>
              }
            </div>

            <aside class="grid gap-5">
              <section
                class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
              >
                <div
                  class="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800"
                >
                  <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Docente del curso
                  </h2>
                </div>
                @if (d.teacherName) {
                  <p class="mt-4 font-semibold text-slate-900 dark:text-white">
                    {{ d.teacherName }}
                  </p>
                  <p class="mt-1 text-sm text-slate-500">
                    Docente de {{ d.courseName || 'este curso' }}
                  </p>
                } @else {
                  <p class="mt-4 text-sm text-slate-500">El docente aún no está asignado.</p>
                }
              </section>
              <section
                class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
              >
                <div
                  class="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800"
                >
                  <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
                    Materiales para estudiar
                  </h2>
                  <span class="text-slate-400" aria-hidden="true">▱</span>
                </div>
                @if (d.materials.length === 0) {
                  <p class="mt-4 text-sm text-slate-500">No hay recursos para mostrar todavía.</p>
                } @else {
                  <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                    @for (material of d.materials.slice(0, 4); track material.publicUuid) {
                      <li class="flex items-start gap-3 py-3">
                        <span class="mt-0.5 text-blue-600" aria-hidden="true">◉</span>
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {{ material.title }}
                          </p>
                          <p class="mt-0.5 truncate text-xs text-slate-500">
                            {{ material.filename || materialKindLabel(material) }}
                          </p>
                        </div>
                      </li>
                    }
                  </ul>
                  <button
                    type="button"
                    class="mt-2 text-sm font-semibold text-blue-700 hover:underline"
                    (click)="activeTab.set('materials')"
                  >
                    Ver todos los materiales
                  </button>
                }
              </section>
              <section class="rounded-2xl bg-blue-50 p-5 dark:bg-blue-950/40">
                <h2 class="font-semibold text-blue-950 dark:text-blue-100">Un consejo</h2>
                <p class="mt-2 text-sm leading-6 text-blue-900/80 dark:text-blue-200">
                  Revisa las fechas de entrega y los archivos adjuntos antes de enviar cada tarea.
                </p>
              </section>
            </aside>
          </div>
        } @else {
          <p class="mt-6 text-sm text-slate-500">No se encontró información para este curso.</p>
        }
      }
    </section>

    @if (previewMaterial(); as material) {
      <app-file-preview-dialog
        [open]="true"
        [filePublicUuid]="material.filePublicUuid"
        [filename]="material.filename || material.title || 'material'"
        (closed)="previewMaterial.set(null)"
      />
    }
  `,
})
export class MeCourseDetailPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly files = inject(FileUploadService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = signal<MeSectionDetail | null>(null);
  readonly activeTab = signal<'tasks' | 'quizzes' | 'materials'>('tasks');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly downloadingMaterial = signal<string | null>(null);
  readonly previewMaterial = signal<MeMaterialItem | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const uuid = this.route.snapshot.paramMap.get('sectionPublicUuid');
    if (!uuid) {
      this.error.set('No se encontró el curso solicitado.');
      this.loading.set(false);
      return;
    }
    const assignment = this.route.snapshot.queryParamMap.get('assignment');
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getSection(uuid, assignment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.detail.set(response.data ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el detalle del curso.');
          this.loading.set(false);
        },
      });
  }

  taskDetailLink(taskUuid: string): string {
    return ROUTES.LMS.assignmentDetail(taskUuid);
  }

  takeLink(quizUuid: string): string {
    return ROUTES.LMS.quizTake(quizUuid);
  }

  materialKindLabel(material: MeMaterialItem): string {
    if (material.kind === 'VIDEO_LINK') return 'Enlace';
    if (material.kind === 'FILE') return 'Archivo';
    return material.kind;
  }

  async onDownloadMaterial(material: MeMaterialItem): Promise<void> {
    if (!material.filePublicUuid) return;
    this.downloadingMaterial.set(material.publicUuid);
    try {
      await this.files.downloadAndSave(
        material.filePublicUuid,
        material.filename || material.title || 'material',
      );
    } catch {
      // global error interceptor
    } finally {
      this.downloadingMaterial.set(null);
    }
  }

  onPreviewMaterial(material: MeMaterialItem): void {
    if (material.filePublicUuid) this.previewMaterial.set(material);
  }
}

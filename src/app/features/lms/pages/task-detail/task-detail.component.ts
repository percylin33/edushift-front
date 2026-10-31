import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission, UserRole } from '@core/enums';
import { AuthService, FileUploadService } from '@core/services';
import { FilePreviewDialogComponent, IconComponent, SpinnerComponent } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives';
import { TasksStore } from '../../store';
import { TaskLifecycle, isTaskEditable, isTaskTerminal } from '../../models';
import { TaskLifecycleBadgeComponent } from '../../components';

/**
 * `/lms/assignments/:uuid` — detail de la tarea (FE-7a.1 Scenario 3).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar la tarea via {@link TasksStore.loadDetail}.</li>
 *   <li>Mostrar el detalle (título, descripción, lifecycle, dueAt,
 *       maxScore, contador de entregas).</li>
 *   <li>Acciones contextual-gated por lifecycle + `*appHasPermission`:
 *     <ul>
 *       <li>Publicar — DRAFT (visible si LMS_TASK_CREATE).</li>
 *       <li>Cerrar — PUBLISHED (visible si LMS_TASK_CREATE).</li>
 *       <li>Editar — solo DRAFT (visible si LMS_TASK_CREATE).</li>
 *       <li>Ver entregas / Calificar — visible si LMS_TASK_GRADE.</li>
 *       <li>Entregar — visible si LMS_TASK_SUBMIT (STUDENT/PARENT).</li>
 *     </ul>
 *   </li>
 *   <li>404 inline si el backend devuelve RESOURCE_NOT_FOUND.</li>
 * </ul>
 */
@Component({
  selector: 'app-task-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    HasPermissionDirective,
    TaskLifecycleBadgeComponent,
    FilePreviewDialogComponent,
  ],
  template: `
    @if (loadingDetail()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando tarea…" />
      </div>
    } @else if (!detail()) {
      <div class="card">
        <div class="card-body text-center">
          <h2 class="text-lg font-semibold text-content">Tarea no encontrada</h2>
          <p class="mt-1 text-sm text-content-muted">
            La tarea que buscas pudo haber sido eliminada o no tienes acceso.
          </p>
          <a
            [routerLink]="listRoute()"
            [queryParams]="listQueryParams()"
            class="btn btn-ghost btn-sm mt-4"
          >
            <app-icon name="arrow-left" [size]="16" />
            Volver a la lista
          </a>
        </div>
      </div>
    } @else {
      @let task = detail()!;
      <div class="mx-auto max-w-6xl space-y-6">
        <a
          [routerLink]="listRoute()"
          [queryParams]="listQueryParams()"
          class="inline-flex items-center gap-2 text-sm font-medium text-content hover:text-primary"
        >
          <app-icon name="arrow-left" [size]="16" />
          {{ isStudent() ? 'Volver al curso' : 'Volver a las tareas' }}
        </a>

        <article class="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <header class="border-b border-border px-5 py-6 sm:px-8 sm:py-8">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2 text-sm text-content-muted">
                <span class="bg-surface-2 rounded-lg px-3 py-2 font-medium">Aula virtual</span>
                @if (task.courseName) {
                  <span aria-hidden="true">/</span><span>{{ task.courseName }}</span>
                }
                @if (task.periodLabel) {
                  <span aria-hidden="true">/</span><span>{{ task.periodLabel }}</span>
                }
              </div>
              <app-task-lifecycle-badge [lifecycle]="task.lifecycle" size="md" />
            </div>
            <h1 class="mt-5 text-3xl font-bold tracking-tight text-content sm:text-4xl">
              {{ task.title }}
            </h1>
            <p class="mt-2 text-sm text-content-muted">
              {{ task.courseName || 'Tarea del curso' }}
              @if (task.periodLabel) {
                <span aria-hidden="true"> · </span>{{ task.periodLabel }}
              }
            </p>
          </header>

          <div class="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
            <section>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
                Indicaciones generales
              </h2>
              <div class="bg-surface-2/60 mt-3 rounded-2xl border border-border p-5 sm:p-6">
                @if (task.description) {
                  <p class="whitespace-pre-line text-base leading-7 text-content">
                    {{ task.description }}
                  </p>
                } @else {
                  <p class="text-sm italic text-content-muted">Esta tarea no tiene descripción.</p>
                }
                <ul class="mt-4 space-y-1 border-t border-border pt-3 text-sm text-content-muted">
                  <li>• Puntaje máximo: {{ task.maxScore }} puntos.</li>
                  <li>
                    • Re-entregas: {{ task.allowResubmissions ? 'permitidas' : 'no permitidas' }}.
                  </li>
                  @if (task.requiresAttachment) {
                    <li>• Debes adjuntar un archivo al entregar.</li>
                  }
                </ul>
              </div>
            </section>

            @if (task.lifecycle === taskLifecycle.Published) {
              <div
                class="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
                role="status"
              >
                <app-icon name="lock" [size]="20" />
                <div>
                  @if (isStudent()) {
                    <p class="font-semibold">La tarea está publicada.</p>
                    <p class="mt-1 text-sm opacity-80">
                      Revisa las indicaciones y registra tu entrega en la plataforma.
                    </p>
                  } @else {
                    <p class="font-semibold">Ya publicaste esta tarea y no se puede editar.</p>
                    <p class="mt-1 text-sm opacity-80">
                      Si detectas un error importante o falta un archivo, ciérrala y crea una nueva
                      con la información correcta. Avisa a tus estudiantes cuál deben realizar.
                    </p>
                  }
                </div>
              </div>
            }

            <section>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
                Parámetros de entrega y evaluación
              </h2>
              <dl class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="bg-surface-2/50 rounded-2xl border border-border p-4">
                  <dt class="text-xs font-medium uppercase tracking-wide text-content-muted">
                    Fecha de vencimiento
                  </dt>
                  <dd class="mt-2 text-lg font-semibold text-content">
                    {{ task.dueAt ? (task.dueAt | date: 'MMM d, y') : 'Sin fecha' }}
                  </dd>
                  <p class="text-sm text-content-muted">
                    {{ task.dueAt ? (task.dueAt | date: 'hh:mm a') : 'Consulta con tu docente' }}
                  </p>
                </div>
                <div class="bg-surface-2/50 rounded-2xl border border-border p-4">
                  <dt class="text-xs font-medium uppercase tracking-wide text-content-muted">
                    Puntaje máximo
                  </dt>
                  <dd class="mt-2 text-2xl font-bold text-primary">
                    {{ task.maxScore }}
                    <span class="text-sm font-medium text-content-muted">puntos</span>
                  </dd>
                  <p class="text-sm text-content-muted">Escala de evaluación de la tarea</p>
                </div>
                <div class="bg-surface-2/50 rounded-2xl border border-border p-4">
                  <dt class="text-xs font-medium uppercase tracking-wide text-content-muted">
                    Entregas realizadas
                  </dt>
                  <dd class="mt-2 text-2xl font-bold text-content">{{ task.submissionsCount }}</dd>
                  <p class="text-sm text-content-muted">Entregas registradas</p>
                </div>
                <div class="bg-surface-2/50 rounded-2xl border border-border p-4">
                  <dt class="text-xs font-medium uppercase tracking-wide text-content-muted">
                    Revisadas / calificadas
                  </dt>
                  <dd class="mt-2 text-2xl font-bold text-content">
                    {{ task.gradedSubmissionsCount }}
                  </dd>
                  <p class="text-sm text-content-muted">
                    Re-entregas {{ task.allowResubmissions ? 'permitidas' : 'no permitidas' }}
                  </p>
                </div>
              </dl>
            </section>

            @if (task.attachmentPublicUuid) {
              <section>
                <h2 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
                  Material adjunto
                </h2>
                <div
                  class="mt-3 flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="flex items-center gap-3">
                    <span
                      class="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50"
                      ><app-icon name="file-text" [size]="22"
                    /></span>
                    <div>
                      <p class="font-semibold text-content">Archivo adjunto de la tarea</p>
                      <p class="text-sm text-content-muted">
                        Consulta el material compartido por tu docente
                      </p>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-3">
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      (click)="previewAttachment.set(true)"
                    >
                      Ver archivo
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      [disabled]="downloadingAttachment()"
                      (click)="downloadAttachment()"
                    >
                      {{ downloadingAttachment() ? 'Descargando…' : 'Descargar' }}
                    </button>
                  </div>
                </div>
              </section>
            }

            @if (errorBanner(); as err) {
              <div class="alert alert-danger" role="alert">
                <app-icon name="alert-circle" [size]="18" />
                <p class="text-sm">{{ err }}</p>
              </div>
            }
          </div>

          <footer
            class="bg-surface-2/40 flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-8"
          >
            <a
              [routerLink]="listRoute()"
              [queryParams]="listQueryParams()"
              class="btn btn-ghost btn-sm"
            >
              <app-icon name="arrow-left" [size]="16" /> Volver
            </a>
            <a
              *appHasPermission="permission.LmsTaskSubmit"
              [routerLink]="submitRoute()"
              class="btn btn-primary btn-sm"
            >
              <app-icon name="upload" [size]="16" /> Entregar tarea
            </a>
            <a
              *appHasPermission="permission.LmsTaskGrade"
              [routerLink]="gradeRoute()"
              class="btn btn-ghost btn-sm"
            >
              <app-icon name="list-checks" [size]="16" /> Ver entregas
            </a>
            @if (canEdit()) {
              <a
                *appHasPermission="permission.LmsTaskCreate"
                [routerLink]="editRoute()"
                class="btn btn-ghost btn-sm"
              >
                <app-icon name="pencil" [size]="16" /> Editar
              </a>
            }
            <button
              *appHasPermission="permission.LmsTaskCreate"
              type="button"
              class="btn btn-primary btn-sm"
              [class.hidden]="!canPublish()"
              [disabled]="saving()"
              (click)="onPublish()"
            >
              <app-icon name="send" [size]="16" /> Publicar
            </button>
            <button
              *appHasPermission="permission.LmsTaskCreate"
              type="button"
              class="btn btn-danger btn-sm"
              [class.hidden]="!canClose()"
              [disabled]="saving()"
              (click)="onClose()"
            >
              <app-icon name="lock" [size]="16" /> Cerrar
            </button>
          </footer>
        </article>
      </div>
    }
    @if (previewAttachment() && detail()?.attachmentPublicUuid) {
      <app-file-preview-dialog
        [open]="true"
        [filePublicUuid]="detail()!.attachmentPublicUuid"
        [filename]="detail()!.title + ' - material adjunto'"
        (closed)="previewAttachment.set(false)"
      />
    }
  `,
})
export class TaskDetailComponent implements OnInit {
  private readonly store = inject(TasksStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly files = inject(FileUploadService);

  protected readonly detail = this.store.selected;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly errorBanner = this.store.error;
  protected readonly saving = this.store.saving;
  protected readonly permission = Permission;
  protected readonly taskLifecycle = TaskLifecycle;
  protected readonly previewAttachment = signal(false);
  protected readonly downloadingAttachment = signal(false);

  private editId: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('uuid');
    if (!id) {
      void this.router.navigate([ROUTES.LMS.ROOT]);
      return;
    }
    if (id === 'new') {
      const section =
        this.route.snapshot.queryParamMap.get('section') ??
        this.route.snapshot.queryParamMap.get('sectionUuid');
      void this.router.navigate(['/lms', 'assignments', 'new'], {
        queryParams: section ? { section } : undefined,
        replaceUrl: true,
      });
      return;
    }
    this.editId = id;
    void this.store.loadDetail(id);
  }

  protected listRoute(): string {
    const task = this.detail();
    const section = task?.sectionPublicUuid;
    if (section && this.isStudent()) return `/me/courses/${section}`;
    return section ? ROUTES.LMS.sectionAssignments(section) : ROUTES.LMS.ROOT;
  }

  protected isStudent(): boolean {
    return this.auth.hasRole(UserRole.Student);
  }

  protected listQueryParams(): { assignment: string } | null {
    const assignment = this.detail()?.teacherAssignmentPublicUuid;
    return assignment ? { assignment } : null;
  }

  protected async downloadAttachment(): Promise<void> {
    const task = this.detail();
    if (!task?.attachmentPublicUuid || this.downloadingAttachment()) return;
    this.downloadingAttachment.set(true);
    try {
      await this.files.downloadAndSave(
        task.attachmentPublicUuid,
        `${task.title || 'tarea'} - material adjunto`,
      );
    } catch {
      // Global error interceptor handles download failures.
    } finally {
      this.downloadingAttachment.set(false);
    }
  }

  protected editRoute(): string {
    return this.editId ? ROUTES.LMS.assignmentEdit(this.editId) : ROUTES.LMS.ROOT;
  }

  protected gradeRoute(): string {
    return this.editId ? ROUTES.LMS.assignmentGrade(this.editId) : ROUTES.LMS.ROOT;
  }

  protected submitRoute(): string {
    return this.editId ? ROUTES.LMS.assignmentSubmit(this.editId) : ROUTES.LMS.ROOT;
  }

  protected canEdit(): boolean {
    const d = this.detail();
    return !!d && isTaskEditable(d);
  }

  protected canPublish(): boolean {
    const d = this.detail();
    return !!d && d.lifecycle === TaskLifecycle.Draft;
  }

  protected canClose(): boolean {
    const d = this.detail();
    return !!d && d.lifecycle === TaskLifecycle.Published && !isTaskTerminal(d.lifecycle);
  }

  protected async onPublish(): Promise<void> {
    if (!this.editId) return;
    await this.store.publishTask(this.editId);
  }

  protected async onClose(): Promise<void> {
    if (!this.editId) return;
    await this.store.closeTask(this.editId);
  }
}

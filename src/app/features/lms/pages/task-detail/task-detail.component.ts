import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission } from '@core/enums';
import {
  IconComponent,
  SpinnerComponent
} from '@shared/components';
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
 *       <li>Editar — DRAFT, o PUBLISHED antes de dueAt (visible si
 *           LMS_TASK_CREATE).</li>
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
    TaskLifecycleBadgeComponent
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
          <a [routerLink]="listRoute()" class="btn btn-ghost btn-sm mt-4">
            <app-icon name="arrow-left" [size]="16" />
            Volver a la lista
          </a>
        </div>
      </div>
    } @else {
      <article class="card">
        <header class="card-header">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-wide text-content-muted">
                {{ detail()!.sectionPublicUuid }}
              </p>
              <h1 class="text-2xl font-semibold text-content">
                {{ detail()!.title }}
              </h1>
            </div>
            <app-task-lifecycle-badge [lifecycle]="detail()!.lifecycle" size="md" />
          </div>
        </header>

        <div class="card-body grid gap-4">
          @if (detail()!.description) {
            <p class="whitespace-pre-line text-sm text-content">
              {{ detail()!.description }}
            </p>
          } @else {
            <p class="text-sm italic text-content-muted">
              Esta tarea no tiene descripción.
            </p>
          }

          <dl class="grid gap-3 sm:grid-cols-4">
            <div>
              <dt class="text-xs font-medium text-content-muted">Vence</dt>
              <dd class="text-sm text-content">
                {{ detail()!.dueAt ? (detail()!.dueAt | date: 'medium') : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-content-muted">Puntaje máx.</dt>
              <dd class="text-sm text-content">{{ detail()!.maxScore }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-content-muted">Entregas</dt>
              <dd class="text-sm text-content">{{ detail()!.submissionsCount }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-content-muted">Re-entregas</dt>
              <dd class="text-sm text-content">
                {{ detail()!.allowResubmissions ? 'Permitidas' : 'No permitidas' }}
              </dd>
            </div>
          </dl>

          @if (errorBanner(); as err) {
            <div class="alert alert-danger" role="alert">
              <app-icon name="alert-circle" [size]="18" />
              <p class="text-sm">{{ err }}</p>
            </div>
          }
        </div>

        <footer class="card-footer flex flex-wrap items-center justify-end gap-2">
          <a [routerLink]="listRoute()" class="btn btn-ghost btn-sm">
            <app-icon name="arrow-left" [size]="16" />
            Volver
          </a>

          <!-- STUDENT / PARENT action (LMS_TASK_SUBMIT) -->
          <a
            *appHasPermission="permission.LmsTaskSubmit"
            [routerLink]="submitRoute()"
            class="btn btn-secondary btn-sm"
          >
            <app-icon name="upload" [size]="16" />
            Entregar
          </a>

          <!-- TEACHER action: list submissions (LMS_TASK_GRADE) -->
          <a
            *appHasPermission="permission.LmsTaskGrade"
            [routerLink]="gradeRoute()"
            class="btn btn-ghost btn-sm"
          >
            <app-icon name="list-checks" [size]="16" />
            Ver entregas
          </a>

          <a
            *appHasPermission="permission.LmsTaskCreate"
            [routerLink]="editRoute()"
            class="btn btn-ghost btn-sm"
            [class.hidden]="!canEdit()"
          >
            <app-icon name="pencil" [size]="16" />
            Editar
          </a>

          <button
            *appHasPermission="permission.LmsTaskCreate"
            type="button"
            class="btn btn-primary btn-sm"
            [class.hidden]="!canPublish()"
            [disabled]="saving()"
            (click)="onPublish()"
          >
            <app-icon name="send" [size]="16" />
            Publicar
          </button>

          <button
            *appHasPermission="permission.LmsTaskCreate"
            type="button"
            class="btn btn-danger btn-sm"
            [class.hidden]="!canClose()"
            [disabled]="saving()"
            (click)="onClose()"
          >
            <app-icon name="lock" [size]="16" />
            Cerrar
          </button>
        </footer>
      </article>
    }
  `
})
export class TaskDetailComponent implements OnInit {
  private readonly store = inject(TasksStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly detail = this.store.selected;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly errorBanner = this.store.error;
  protected readonly saving = this.store.saving;
  protected readonly permission = Permission;

  private editId: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('uuid');
    if (!id) {
      void this.router.navigate([ROUTES.LMS.ROOT]);
      return;
    }
    this.editId = id;
    void this.store.loadDetail(id);
  }

  protected listRoute(): string {
    const section = this.detail()?.sectionPublicUuid;
    return section ? ROUTES.LMS.sectionAssignments(section) : ROUTES.LMS.ROOT;
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

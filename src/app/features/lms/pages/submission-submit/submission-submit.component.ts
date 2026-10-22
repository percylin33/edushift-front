import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { ApiError } from '@core/models';
import { AuthService } from '@core/services';
import { SpinnerComponent } from '@shared/components';
import { MeApiService } from '@features/me/services/me-api.service';
import { TasksStore } from '../../store';
import { SubmissionsStore } from '../../store';
import { MySubmissionsCardComponent } from '../../components';
import { SubmissionFormComponent } from '../../components';
import { Submission, canResubmit } from '../../models';

/**
 * `/lms/assignments/:uuid/submit` — STUDENT/PARENT view de entrega
 * (FE-7a.2 Scenario 1).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar la tarea ({@code maxScore}, {@code allowResubmissions},
 *       {@code dueAt}) y la submission del alumno actual.</li>
 *   <li>Mostrar la {@link MySubmissionsCardComponent} con la entrega
 *       existente (si hay) y, debajo, el {@link SubmissionFormComponent}
 *       prellenado para re-entrega cuando aplique.</li>
 *   <li>Orquestar {@link SubmissionsStore.create} /
 *       {@link SubmissionsStore.update} desde los eventos del form.</li>
 *   <li>Mapear errores del backend a mensajes inline (file too large,
 *       type not allowed, submission already graded, etc.).</li>
 * </ul>
 */
@Component({
  selector: 'app-submission-submit',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SpinnerComponent,
    MySubmissionsCardComponent,
    SubmissionFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <div class="min-w-0">
        <p class="mb-4 text-sm font-medium text-primary">
          <a [routerLink]="assignmentRoute()" class="inline-flex items-center gap-2 hover:underline">
            <span aria-hidden="true">←</span>
            Volver a la tarea
          </a>
        </p>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold tracking-tight text-content">Entregar tarea</h1>
            @if (assignmentTitle()) {
              <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span class="rounded-full bg-surface-muted px-3 py-1 font-medium text-content">
                  {{ assignmentTitle() }}
                </span>
                @if (dueAt()) {
                <span class="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  Vence {{ dueAt() | date: 'dd/MM/yyyy, HH:mm' }}
                  </span>
                }
                <span class="text-content-muted">{{ maxScore() }} pts. máx.</span>
              </div>
            }
          </div>
        </div>
      </div>
    </header>

    @if (loadingTask()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando tarea…" />
      </div>
    } @else {
      <div class="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <aside class="grid gap-5">
          <app-my-submissions-card
            [submission]="mySubmission()"
            [showResubmit]="canResubmitNow()"
            [allowResubmissions]="allowResubmissions()"
            [maxScore]="maxScore()"
            (resubmit)="onResubmit()"
          />

          @if (assignmentTitle()) {
            <section class="card" aria-labelledby="assignment-details-title">
              <div class="card-body space-y-4">
                <div class="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <h2 id="assignment-details-title" class="text-base font-semibold text-content">
                    Instrucciones del docente
                  </h2>
                  <span class="shrink-0 text-xs text-content-muted">Detalles de la tarea</span>
                </div>
                @if (assignmentDescription()) {
                  <p class="whitespace-pre-line text-sm leading-6 text-content">
                    {{ assignmentDescription() }}
                  </p>
                } @else {
                  <p class="text-sm italic text-content-muted">
                    Esta tarea no tiene instrucciones adicionales.
                  </p>
                }
                <dl class="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                  <div>
                    <dt class="text-xs font-medium text-content-muted">Calificación</dt>
                    <dd class="mt-1 font-semibold text-content">{{ maxScore() }} pts. máx.</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-content-muted">Re-entregas</dt>
                    <dd class="mt-1 font-medium text-content">
                      {{ allowResubmissions() ? 'Permitidas' : 'No permitidas' }}
                    </dd>
                  </div>
                </dl>
                @if (requiresAttachment()) {
                  <p class="rounded-lg bg-primary/5 px-3 py-2 text-sm text-content">
                    Esta tarea requiere adjuntar un archivo.
                  </p>
                }
              </div>
            </section>
          }
        </aside>

        <div class="min-w-0">
          @if (showForm()) {
            <app-submission-form
              [assignmentUuid]="assignmentUuid"
              [existingSubmission]="mySubmission()"
              [allowResubmissions]="allowResubmissions()"
              [errorMessage]="errorBanner()"
              [uploading]="uploading()"
              [uploadPercent]="uploadPercent()"
              [studentPublicUuid]="studentPublicUuid()"
              (submitCreate)="onCreate($event)"
              (submitUpdate)="onUpdate($event)"
            />
          } @else if (mySubmission() && !canResubmitNow()) {
            <div class="card">
              <div class="card-body">
                <p class="text-sm text-content">
                  Esta tarea ya fue calificada y no permite re-entregas.
                </p>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class SubmissionSubmitComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tasksStore = inject(TasksStore);
  private readonly submissionsStore = inject(SubmissionsStore);
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);

  protected readonly mySubmission = signal<Submission | null>(null);
  protected readonly assignmentTitle = signal<string | null>(null);
  protected readonly assignmentDescription = signal<string | null>(null);
  protected readonly dueAt = signal<Date | null>(null);
  protected readonly maxScore = signal(0);
  protected readonly allowResubmissions = signal(false);
  protected readonly requiresAttachment = signal(false);
  protected readonly errorBanner = this.submissionsStore.error;
  protected readonly uploading = this.submissionsStore.uploading;
  protected readonly uploadPercent = this.submissionsStore.uploadPercent;
  protected readonly loadingTask = signal(false);
  protected readonly showForm = signal(true);
  protected readonly studentPublicUuid = signal<string | null>(null);

  protected assignmentUuid = '';

  protected readonly canResubmitNow = (): boolean => {
    const e = this.mySubmission();
    if (!e) return true;
    return canResubmit(e.status, this.allowResubmissions());
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('uuid');
    if (!id) {
      void this.router.navigate([ROUTES.LMS.ROOT]);
      return;
    }
    this.assignmentUuid = id;

    this.loadingTask.set(true);
    void this.bootstrap(id);
  }

  private async bootstrap(assignmentUuid: string): Promise<void> {
    const queryStudent =
      this.route.snapshot.queryParamMap.get('studentPublicUuid') ??
      this.route.snapshot.queryParamMap.get('student');
    let studentUuid = queryStudent?.trim() || null;
    if (!studentUuid && this.auth.hasRole(UserRole.Student)) {
      try {
        const profile = await firstValueFrom(this.meApi.getProfile());
        studentUuid = profile.data?.userPublicUuid ?? profile.data?.publicUuid ?? null;
      } catch {
        studentUuid = null;
      }
    }
    this.studentPublicUuid.set(studentUuid);

    const [detail, mine] = await Promise.all([
      this.tasksStore.loadDetail(assignmentUuid),
      this.submissionsStore.loadMySubmission(assignmentUuid, studentUuid),
    ]);
    if (detail) {
      this.assignmentTitle.set(detail.title);
      this.assignmentDescription.set(detail.description);
      this.dueAt.set(detail.dueAt);
      this.maxScore.set(detail.maxScore);
      this.allowResubmissions.set(detail.allowResubmissions);
      this.requiresAttachment.set(detail.requiresAttachment);
    }
    this.mySubmission.set(mine);
    this.loadingTask.set(false);
  }

  protected onResubmit(): void {
    this.showForm.set(true);
  }

  protected assignmentRoute(): string {
    return ROUTES.LMS.assignmentDetail(this.assignmentUuid);
  }

  protected async onCreate(payload: {
    textContent: string | null;
    attachment: File | null;
    submittedForStudentPublicUuid: string | null;
    studentPublicUuid?: string | null;
  }): Promise<void> {
    const created = await this.submissionsStore.create(this.assignmentUuid, {
      studentPublicUuid:
        this.studentPublicUuid() ||
        payload.studentPublicUuid ||
        payload.submittedForStudentPublicUuid ||
        '',
      textBody: payload.textContent,
      attachment: payload.attachment,
    });
    if (created) {
      this.mySubmission.set(created);
      this.showForm.set(false);
    } else {
      this.mapServerError();
    }
  }

  protected async onUpdate(payload: {
    textContent: string | null;
    attachment: File | null;
  }): Promise<void> {
    const e = this.mySubmission();
    if (!e) return;
    const updated = await this.submissionsStore.update(e.publicUuid, payload);
    if (updated) {
      this.mySubmission.set(updated);
      this.showForm.set(false);
    } else {
      this.mapServerError();
    }
  }

  private mapServerError(): void {
    // Por ahora el banner genérico lo setea el store. Aquí podríamos
    // refinar mapeando `LMS_SUBMISSION_*` codes (e.g.
    // LMS_SUBMISSION_GRADED_NO_RESUBMIT, LMS_SUBMISSION_FILE_TOO_LARGE)
    // — sin lista cerrada de codes los dejamos como `tech-debt.md`
    // (DEBT-FE-7A-3).
    void (null as unknown as HttpErrorResponse);
    void (null as unknown as ApiError);
  }
}

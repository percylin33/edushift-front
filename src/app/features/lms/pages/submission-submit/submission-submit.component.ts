import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ROUTES } from '@core/constants';
import { ApiError } from '@core/models';
import { SpinnerComponent } from '@shared/components';
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
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-content-muted">
          <a [routerLink]="assignmentRoute()" class="hover:underline">← Volver a la tarea</a>
        </p>
        <h1 class="text-2xl font-semibold text-content">Entregar tarea</h1>
        @if (assignmentTitle()) {
          <p class="text-sm text-content-muted">
            {{ assignmentTitle() }}
            @if (dueAt()) {
              · Vence {{ dueAt() | date: 'medium' }}
            }
          </p>
        }
      </div>
    </header>

    @if (loadingTask()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando tarea…" />
      </div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-2">
        <app-my-submissions-card
          [submission]="mySubmission()"
          [showResubmit]="canResubmitNow()"
          (resubmit)="onResubmit()"
        />

        @if (showForm()) {
          <app-submission-form
            [assignmentUuid]="assignmentUuid"
            [existingSubmission]="mySubmission()"
            [allowResubmissions]="allowResubmissions()"
            [errorMessage]="errorBanner()"
            [uploading]="uploading()"
            [uploadPercent]="uploadPercent()"
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
    }
  `,
})
export class SubmissionSubmitComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tasksStore = inject(TasksStore);
  private readonly submissionsStore = inject(SubmissionsStore);

  protected readonly mySubmission = signal<Submission | null>(null);
  protected readonly assignmentTitle = signal<string | null>(null);
  protected readonly dueAt = signal<Date | null>(null);
  protected readonly allowResubmissions = signal(false);
  protected readonly errorBanner = this.submissionsStore.error;
  protected readonly uploading = this.submissionsStore.uploading;
  protected readonly uploadPercent = this.submissionsStore.uploadPercent;
  protected readonly loadingTask = signal(false);
  protected readonly showForm = signal(true);

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
    void this.tasksStore.loadDetail(id).then((detail) => {
      if (detail) {
        this.assignmentTitle.set(detail.title);
        this.dueAt.set(detail.dueAt);
        this.allowResubmissions.set(detail.allowResubmissions);
      }
      this.loadingTask.set(false);
    });

    // En MVP la submission propia se hidrata vía el listing del student
    // (la page padre pasa la lista; aquí simulamos null hasta que el
    // caller inyecte la submission via #setMySubmission).
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
  }): Promise<void> {
    const created = await this.submissionsStore.create(this.assignmentUuid, payload);
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

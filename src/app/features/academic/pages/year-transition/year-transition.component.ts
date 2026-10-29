import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { ConfirmDialogService, IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '../../services';
import { AcademicStore } from '../../store';
import {

  AcademicPeriodRow,
  AcademicYearRow,
  AcademicYearStatus,
  CreateSectionRequest,
  PeriodType,
  SectionRow,
  PERIOD_TYPE_DIVISIONS,
  PERIOD_TYPE_LABELS,
} from '../../models';
import { StudentsApiService } from '@features/students/services';
import { SectionStudentRosterItem } from '@features/students/models';
import { ScheduleApiService } from '@features/schedule/services/schedule-api.service';
import { AssignmentRow } from '@features/teachers/models';
import { TeachersApiService } from '@features/teachers/services/teachers-api.service';

interface PeriodDraft {
  ordinal: number;
  name: string;
  startDate: string;
  endDate: string;
}

interface SectionDraft {
  source: SectionRow;
  targetGradeUuid: string;
  targetSectionUuid?: string;
}

interface StudentDraft {
  student: SectionStudentRosterItem;
  sourceSectionUuid: string;
  targetSectionUuid?: string;
  targetSectionName?: string;
  include: boolean;
  alreadyEnrolled: boolean;
  result?: 'created' | 'skipped' | 'error';
  resultMessage?: string;
}

interface AssignmentCloneDraft {
  source: AssignmentRow;
  targetSectionUuid: string;
  targetPeriodUuid: string;
}

const PERIOD_TYPES = [PeriodType.Bimestre, PeriodType.Trimestre, PeriodType.Anual];

function dateAtUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function errorDetails(error: unknown): { code?: string; message: string } {
  const candidate = error as {
    error?: { code?: string; message?: string; detail?: string };
    message?: string;
  };
  return {
    code: candidate?.error?.code,
    message:
      candidate?.error?.message ??
      candidate?.error?.detail ??
      candidate?.message ??
      'Error inesperado.',
  };
}

/**
 * Asistente de transición académica. Crea el año en planificación,
 * prepara períodos y secciones, permite revisar la promoción de cada
 * estudiante, clona las plantillas de jornada y activa el nuevo año
 * solo después de una confirmación final.
 */
@Component({
  selector: 'app-year-transition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <header class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-primary-600">Académico</p>
        <h1 class="text-2xl font-semibold text-content">Preparar el siguiente año</h1>
        <p class="mt-1 max-w-3xl text-sm text-content-muted">
          Revisa la propuesta con calma. El año vigente seguirá activo hasta que confirmes la
          activación al final del asistente.
        </p>
      </div>
      <a [routerLink]="yearsRoute" class="btn btn-ghost btn-sm self-start sm:self-auto">
        <app-icon name="arrow-left" [size]="16" /> Volver a años
      </a>
    </header>

    <nav class="mb-5 grid grid-cols-2 gap-2 md:grid-cols-6" aria-label="Pasos de preparación">
      @for (item of stepLabels; track item; let i = $index) {
        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-left text-xs font-medium transition"
          [class.border-primary-500]="step() === i"
          [class.bg-primary-50]="step() === i"
          [class.text-primary-700]="step() === i"
          [class.border-border]="step() !== i"
          [class.text-content-muted]="step() !== i"
          (click)="goToStep(i)"
        >
          <span class="mr-1 opacity-60">{{ i + 1 }}.</span>{{ item }}
        </button>
      }
    </nav>

    @if (pageError()) {
      <div class="alert alert-danger mb-4" role="alert">{{ pageError() }}</div>
    }
    @if (pageMessage()) {
      <div class="alert alert-success mb-4" role="status">{{ pageMessage() }}</div>
    }

    <section class="card">
      <div class="card-body space-y-5">
        @switch (step()) {
          @case (0) {
            <div>
              <h2 class="card-title">1. Año y calendario</h2>
              <p class="mt-1 text-sm text-content-muted">
                Puedes continuar un año en planificación o crear uno nuevo. El año de origen se usa
                para proponer secciones y jornadas.
              </p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="label" for="transition-target">Año que vas a preparar</label>
                <select
                  id="transition-target"
                  class="select"
                  [ngModel]="targetYearUuid()"
                  (ngModelChange)="selectTarget($event)"
                >
                  <option value="">Crear un año nuevo…</option>
                  @for (year of planningYears(); track year.publicUuid) {
                    <option [value]="year.publicUuid">{{ year.name }} · En planificación</option>
                  }
                </select>
              </div>
              <div>
                <label class="label" for="transition-source">Tomar como referencia</label>
                <select
                  id="transition-source"
                  class="select"
                  [ngModel]="sourceYearUuid()"
                  (ngModelChange)="selectSource($event)"
                >
                  <option value="">No usar un año de referencia</option>
                  @for (year of sourceYears(); track year.publicUuid) {
                    <option [value]="year.publicUuid">
                      {{ year.name }} · {{ statusLabel(year.status) }}
                    </option>
                  }
                </select>
              </div>
            </div>

            @if (!targetYearUuid()) {
              <div
                class="grid gap-4 rounded-lg border border-border-subtle bg-surface-subtle p-4 md:grid-cols-3"
              >
                <div>
                  <label class="label" for="new-year-name">Nombre del año</label>
                  <input
                    id="new-year-name"
                    class="input"
                    [(ngModel)]="newYearName"
                    maxlength="50"
                    placeholder="2027"
                  />
                </div>
                <div>
                  <label class="label" for="new-year-start">Fecha de inicio</label>
                  <input id="new-year-start" class="input" type="date" [(ngModel)]="newStartDate" />
                </div>
                <div>
                  <label class="label" for="new-year-end">Fecha de fin</label>
                  <input id="new-year-end" class="input" type="date" [(ngModel)]="newEndDate" />
                </div>
                <div class="md:col-span-3">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="creatingYear()"
                    (click)="createTargetYear()"
                  >
                    @if (creatingYear()) {
                      <app-spinner [size]="16" label="Creando año" />
                    }
                    Crear año en planificación
                  </button>
                </div>
              </div>
            } @else {
              @if (targetYear(); as year) {
                <div
                  class="rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900"
                >
                  Preparando <strong>{{ year.name }}</strong> ({{
                    year.startDate | date: 'mediumDate'
                  }}
                  – {{ year.endDate | date: 'mediumDate' }}). Estado: planificación.
                </div>
              }
            }

            <div class="rounded-lg border border-border-subtle p-4">
              <h3 class="font-medium text-content">Estructura de períodos</h3>
              <p class="mt-1 text-sm text-content-muted">
                Elige bimestres, trimestres o un período anual. Las fechas sugeridas se reparten
                dentro del año y puedes corregirlas antes de guardarlas.
              </p>
              @if (targetYearUuid()) {
                <div class="mt-3 flex flex-wrap items-end gap-3">
                  <div class="w-full max-w-xs">
                    <label class="label" for="period-type">Tipo de período</label>
                    <select
                      id="period-type"
                      class="select"
                      [ngModel]="periodType()"
                      (ngModelChange)="changePeriodType($event)"
                    >
                      @for (type of periodTypes; track type) {
                        <option [value]="type">{{ periodTypeLabels[type] }}</option>
                      }
                    </select>
                  </div>
                  @if (missingPeriodDrafts().length > 0) {
                    <button
                      type="button"
                      class="btn btn-outline btn-sm"
                      [disabled]="savingPeriods() || missingPeriodDrafts().length === 0"
                      (click)="savePeriods()"
                    >
                      @if (savingPeriods()) {
                        <app-spinner [size]="16" label="Guardando períodos" />
                      }
                      Guardar {{ missingPeriodDrafts().length }} período(s) pendiente(s)
                    </button>
                  } @else {
                    <span class="badge badge-success">{{ configuredPeriodCount() }} período(s) configurado(s)</span>
                  }
                </div>
                @if (missingPeriodDrafts().length > 0) {
                  <div class="mt-3 space-y-2">
                    @for (period of missingPeriodDrafts(); track period.ordinal; let i = $index) {
                      <div
                        class="grid items-end gap-2 rounded border border-border-subtle p-3 sm:grid-cols-3"
                      >
                        <p class="pb-2 text-sm font-medium">{{ period.name }}</p>
                        <div>
                          <label class="label text-xs" [for]="'period-start-' + i">Desde</label
                          ><input
                            class="input"
                            type="date"
                            [id]="'period-start-' + i"
                            [ngModel]="period.startDate"
                            (ngModelChange)="updatePeriodDraft(i, 'startDate', $event)"
                          />
                        </div>
                        <div>
                          <label class="label text-xs" [for]="'period-end-' + i">Hasta</label
                          ><input
                            class="input"
                            type="date"
                            [id]="'period-end-' + i"
                            [ngModel]="period.endDate"
                            (ngModelChange)="updatePeriodDraft(i, 'endDate', $event)"
                          />
                        </div>
                      </div>
                    }
                  </div>
                }
              } @else {
                <p class="mt-3 text-sm text-content-muted">
                  Crea o selecciona un año para preparar sus períodos.
                </p>
              }
            </div>
          }

          @case (1) {
            <div>
              <h2 class="card-title">2. Secciones para el nuevo año</h2>
              <p class="mt-1 text-sm text-content-muted">
                Proponemos avanzar cada grado al siguiente del mismo nivel. Puedes cambiar el grado
                destino, mantener el mismo para repetición o excluir una sección.
              </p>
            </div>
            @if (loadingSource()) {
              <div class="flex justify-center py-8">
                <app-spinner [size]="24" label="Cargando secciones anteriores" />
              </div>
            } @else if (sectionDrafts().length === 0) {
              <div
                class="rounded-lg border border-dashed border-border p-5 text-sm text-content-muted"
              >
                No encontramos secciones activas en el año de referencia. Puedes configurarlas en
                <a class="font-medium text-primary underline" [routerLink]="sectionsRoute"
                  >Académico → Secciones</a
                >
                y luego regresar para continuar.
              </div>
            } @else {
              <div class="space-y-3">
                @for (draft of sectionDrafts(); track draft.source.publicUuid) {
                  <div
                    class="grid gap-3 rounded-lg border border-border-subtle p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
                  >
                    <div>
                      <p class="font-medium text-content">
                        {{ draft.source.levelCode }} · {{ draft.source.gradeName }} · Sección
                        {{ draft.source.name }}
                      </p>
                      <p class="text-xs text-content-muted">
                        {{ rosterCounts()[draft.source.publicUuid] }} estudiante(s) en el padrón
                        actual
                      </p>
                    </div>
                    <div>
                      <label class="label" [for]="'target-grade-' + draft.source.publicUuid"
                        >Grado destino</label
                      >
                      <select
                        class="select"
                        [id]="'target-grade-' + draft.source.publicUuid"
                        [ngModel]="draft.targetGradeUuid"
                        (ngModelChange)="setTargetGrade(draft.source.publicUuid, $event)"
                      >
                        <option value="">No crear / no promover</option>
                        @for (level of levels(); track level.publicUuid) {
                          <optgroup [label]="level.name">
                            @for (grade of level.grades; track grade.publicUuid) {
                              <option [value]="grade.publicUuid">{{ grade.name }}</option>
                            }
                          </optgroup>
                        }
                      </select>
                    </div>
                    <div class="text-sm text-content-muted">
                      @if (draft.targetSectionUuid) {
                        <span class="badge badge-success"
                          >Lista: {{ targetSectionName(draft) }}</span
                        >
                      } @else {
                        <span>Se creará como {{ targetSectionName(draft) }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="creatingSections()"
                  (click)="createTargetSections()"
                >
                  @if (creatingSections()) {
                    <app-spinner [size]="16" label="Creando secciones" />
                  }
                  Crear secciones seleccionadas
                </button>
                @if (sectionsProgress()) {
                  <span class="text-xs text-content-muted">{{ sectionsProgress() }}</span>
                }
              </div>
            }
          }

          @case (2) {
            <div>
              <h2 class="card-title">3. Revisar y matricular estudiantes</h2>
              <p class="mt-1 text-sm text-content-muted">
                La propuesta marca a los estudiantes con una sección destino. Desmarca a quienes
                egresan, se trasladan o aún no deben matricularse; cada matrícula queda vinculada al
                nuevo año y conserva el historial anterior.
              </p>
            </div>
            @if (studentDrafts().length === 0) {
              <div class="rounded-lg border border-border-subtle p-4 text-sm text-content-muted">
                No hay estudiantes que puedan asociarse a las secciones creadas. Revisa el paso de
                secciones o continúa sin copiar matrículas.
              </div>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                (click)="confirmNoStudentMigration()"
              >
                Confirmar y continuar sin copiar matrículas
              </button>
            } @else {
              <div
                class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-subtle p-3"
              >
                <span class="text-sm"
                  >{{ selectedStudentCount() }} de {{ studentDrafts().length }} estudiantes
                  seleccionados</span
                >
                <div class="flex gap-2">
                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    (click)="selectAllStudents(true)"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    (click)="selectAllStudents(false)"
                  >
                    Desmarcar todos
                  </button>
                </div>
              </div>
              <div
                class="max-h-[28rem] divide-y divide-border-subtle overflow-auto rounded-lg border border-border-subtle"
              >
                @for (
                  student of studentDrafts();
                  track student.student.studentPublicUuid + student.sourceSectionUuid
                ) {
                  <label
                    class="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-subtle"
                  >
                    <input
                      type="checkbox"
                      [checked]="student.include"
                      [disabled]="student.alreadyEnrolled || !student.targetSectionUuid"
                      (change)="toggleStudentEvent(student, $event)"
                    />
                    <span class="min-w-0 flex-1"
                      ><span class="font-medium text-content">{{
                        student.student.studentFullName
                      }}</span
                      ><span class="ml-2 text-xs text-content-muted"
                        >{{ student.student.studentDocumentType }}
                        {{ student.student.studentDocumentNumber }} ·
                        {{ student.targetSectionName ?? 'Sin sección destino' }}</span
                      ></span
                    >
                    @if (student.alreadyEnrolled) {
                      <span class="badge badge-success">Ya matriculado</span>
                    } @else if (student.result === 'created') {
                      <span class="badge badge-success">Matriculado</span>
                    } @else if (student.result === 'error') {
                      <span class="badge badge-danger" [title]="student.resultMessage"
                        >Revisar error</span
                      >
                    }
                  </label>
                }
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="savingEnrollments() || selectedStudentCount() === 0"
                  (click)="enrollSelectedStudents()"
                >
                  @if (savingEnrollments()) {
                    <app-spinner [size]="16" label="Guardando matrículas" />
                  }
                  Matricular selección
                </button>
                @if (enrollmentProgress()) {
                  <span class="text-xs text-content-muted">{{ enrollmentProgress() }}</span>
                }
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                (click)="confirmNoStudentMigration()"
              >
                Continuar sin copiar las matrículas seleccionadas
              </button>
            }
          }

          @case (3) {
            <div>
              <h2 class="card-title">4. Docentes y jornada escolar</h2>
              <p class="mt-1 text-sm text-content-muted">
                Puedes copiar las asignaciones de cursos y docentes que coincidan con las nuevas
                secciones y períodos. Los horarios semanales de clase deben revisarse por separado.
              </p>
            </div>
            <div class="rounded-lg border border-border-subtle p-4">
              <h3 class="font-medium text-content">Asignaciones de cursos y docentes</h3>
              <p class="mt-1 text-sm text-content-muted">
                Se propone conservar docente y curso, relacionando la nueva sección con el mismo
                nombre y el período con igual tipo y ordinal. Revisa las excepciones antes de
                confirmar la revisión.
              </p>
              @if (assignmentPreviewLoaded()) {
                <p class="mt-3 text-sm">
                  {{ assignmentCloneDrafts().length }} asignación(es) compatibles;
                  {{ sourceAssignments().length - assignmentCloneDrafts().length }} no tienen
                  una sección/período equivalente y se omitirán.
                </p>
                <button
                  class="btn btn-outline btn-sm mt-3"
                  type="button"
                  [disabled]="cloningAssignments() || assignmentCloneDrafts().length === 0"
                  (click)="cloneTeacherAssignments()"
                >
                  @if (cloningAssignments()) {
                    <app-spinner [size]="16" label="Copiando asignaciones" />
                  }
                  Copiar asignaciones compatibles
                </button>
                @if (assignmentCloneProgress()) {
                  <p class="mt-2 text-xs text-content-muted">{{ assignmentCloneProgress() }}</p>
                }
                @if (assignmentCloneErrors().length > 0) {
                  <ul class="mt-2 list-disc pl-5 text-xs text-danger">
                    @for (error of assignmentCloneErrors(); track error) {
                      <li>{{ error }}</li>
                    }
                  </ul>
                }
              } @else {
                <button
                  class="btn btn-outline btn-sm mt-3"
                  type="button"
                  [disabled]="loadingAssignmentPreview() || !sourceYearUuid() || !targetYearUuid()"
                  (click)="analyzeTeacherAssignments()"
                >
                  @if (loadingAssignmentPreview()) {
                    <app-spinner [size]="16" label="Revisando asignaciones" />
                  }
                  Revisar asignaciones anteriores
                </button>
              }
            </div>
            <div class="rounded-lg border border-border-subtle p-4">
              @if (!sourceYearUuid()) {
                <p class="text-sm text-content-muted">
                  Selecciona un año de referencia en el primer paso para clonar sus plantillas.
                </p>
              } @else if (scheduleCopied()) {
                <div class="text-success-700 flex items-center gap-2 text-sm">
                  <app-icon name="check" [size]="18" /> Se clonaron
                  {{ clonedTemplateCount() }} plantilla(s) de jornada.
                </div>
              } @else {
                <p class="text-sm text-content-muted">
                  Las plantillas ya existentes en el año destino se conservarán; el backend evita
                  duplicarlas.
                </p>
                <button
                  class="btn btn-outline btn-sm mt-3"
                  type="button"
                  [disabled]="cloningSchedule() || !targetYearUuid()"
                  (click)="cloneDayTemplates()"
                >
                  @if (cloningSchedule()) {
                    <app-spinner [size]="16" label="Clonando jornada" />
                  }
                  Clonar plantillas de jornada
                </button>
              }
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <a
                [routerLink]="sectionsRoute"
                target="_blank"
                rel="noopener"
                class="rounded-lg border border-border-subtle p-4 hover:border-primary-300"
              >
                <p class="font-medium text-content">
                  Revisar secciones y tutores <span aria-hidden="true">→</span>
                </p>
                <p class="mt-1 text-sm text-content-muted">
                  Verifica capacidades, tutores y secciones que no continúan.
                </p>
              </a>
              <a
                [routerLink]="teachersRoute"
                target="_blank"
                rel="noopener"
                class="rounded-lg border border-border-subtle p-4 hover:border-primary-300"
              >
                <p class="font-medium text-content">
                  Reasignar docentes y cursos <span aria-hidden="true">→</span>
                </p>
                <p class="mt-1 text-sm text-content-muted">
                  Las asignaciones docentes y sus horarios pertenecen al año/período.
                </p>
              </a>
              <a
                [routerLink]="gradeRegisterRoute"
                target="_blank"
                rel="noopener"
                class="rounded-lg border border-border-subtle p-4 hover:border-primary-300"
              >
                <p class="font-medium text-content">
                  Revisar registro de notas <span aria-hidden="true">→</span>
                </p>
                <p class="mt-1 text-sm text-content-muted">
                  Confirma las plantillas de evaluación para el nuevo ciclo.
                </p>
              </a>
              <a
                [routerLink]="jornadaRoute"
                target="_blank"
                rel="noopener"
                class="rounded-lg border border-border-subtle p-4 hover:border-primary-300"
              >
                <p class="font-medium text-content">
                  Ajustar jornada y recreos <span aria-hidden="true">→</span>
                </p>
                <p class="mt-1 text-sm text-content-muted">
                  Edita el horario institucional y valida los bloques.
                </p>
              </a>
            </div>
            <label class="flex items-start gap-3 rounded-lg bg-surface-subtle p-4 text-sm">
              <input
                type="checkbox"
                class="mt-1"
                [ngModel]="staffReviewConfirmed()"
                (ngModelChange)="staffReviewConfirmed.set($event)"
              />
              <span
                >Revisé las asignaciones de docentes, cursos y el registro de notas del nuevo año (o
                confirmé que se configurarán después).</span
              >
            </label>
          }

          @case (4) {
            <div>
              <h2 class="card-title">5. Revisión antes de activar</h2>
              <p class="mt-1 text-sm text-content-muted">
                Comprueba los elementos del año nuevo. La activación cerrará el año vigente y el
                cierre no se puede revertir desde la app.
              </p>
            </div>
            <dl class="divide-y divide-border-subtle rounded-lg border border-border-subtle">
              <div class="flex items-center justify-between gap-3 p-4">
                <dt>Nuevo año</dt>
                <dd class="font-medium">{{ targetYear()?.name ?? 'No creado' }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 p-4">
                <dt>Períodos académicos</dt>
                <dd>{{ targetPeriods().length }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 p-4">
                <dt>Secciones del nuevo año</dt>
                <dd>{{ targetSections().length }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 p-4">
                <dt>Matrículas procesadas en este asistente</dt>
                <dd>{{ enrollmentCreatedCount() }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 p-4">
                <dt>Asignaciones de curso y docente copiadas</dt>
                <dd>{{ clonedAssignmentCount() }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 p-4">
                <dt>Plantillas de jornada clonadas</dt>
                <dd>{{ clonedTemplateCount() }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 p-4">
                <dt>Revisión de asignaciones docentes y notas</dt>
                <dd>{{ staffReviewConfirmed() ? 'Confirmada' : 'Pendiente' }}</dd>
              </div>
            </dl>
            @if (activationBlockers().length > 0) {
              <div class="alert alert-warning">
                <p class="font-medium">Aún faltan pasos para activar:</p>
                <ul class="mt-2 list-disc pl-5">
                  @for (blocker of activationBlockers(); track blocker) {
                    <li>{{ blocker }}</li>
                  }
                </ul>
              </div>
            }
            @if (activationCompleted()) {
              <div class="alert alert-success" role="status">
                Año activado correctamente. El ciclo anterior quedó cerrado.
              </div>
            } @else {
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="activationBlockers().length > 0 || activating()"
                (click)="activateNewYear()"
              >
                @if (activating()) {
                  <app-spinner [size]="16" label="Activando año" />
                }
                Activar año y cerrar el anterior
              </button>
            }
          }
        }

        <footer class="flex items-center justify-between border-t border-border-subtle pt-4">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="step() === 0"
            (click)="previousStep()"
          >
            Anterior
          </button>
          @if (step() < 4) {
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="!canAdvance()"
              (click)="nextStep()"
            >
              Continuar
            </button>
          } @else {
            <span class="text-xs text-content-muted"
              >La activación requiere completar la revisión.</span
            >
          }
        </footer>
      </div>
    </section>
  `,
})
export class YearTransitionComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly academicApi = inject(AcademicApiService);
  private readonly studentsApi = inject(StudentsApiService);
  private readonly scheduleApi = inject(ScheduleApiService);
  private readonly teachersApi = inject(TeachersApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly yearsRoute = ROUTES.ACADEMIC.YEARS.LIST;
  protected readonly sectionsRoute = ROUTES.ACADEMIC.SECTIONS.LIST;
  protected readonly teachersRoute = ROUTES.TEACHERS.LIST;
  protected readonly gradeRegisterRoute = ROUTES.ACADEMIC.GRADE_REGISTER.SETTINGS;
  protected readonly jornadaRoute = ROUTES.SCHEDULE.JORNADA;
  protected readonly stepLabels = [
    'Año y períodos',
    'Secciones',
    'Estudiantes',
    'Jornada',
    'Activar',
  ];
  protected readonly periodTypes = PERIOD_TYPES;
  protected readonly periodTypeLabels = PERIOD_TYPE_LABELS;

  protected readonly step = signal(0);
  protected readonly years = this.store.years;
  protected readonly levels = this.store.levels;
  protected readonly planningYears = computed(() =>
    this.years().filter((year) => year.status === AcademicYearStatus.Planning),
  );
  protected readonly sourceYears = computed(() =>
    this.years().filter((year) => year.publicUuid !== this.targetYearUuid()),
  );
  protected readonly targetYearUuid = signal('');
  protected readonly sourceYearUuid = signal('');
  protected readonly targetYear = computed(
    () => this.years().find((year) => year.publicUuid === this.targetYearUuid()) ?? null,
  );
  protected readonly targetPeriods = signal<AcademicPeriodRow[]>([]);
  protected readonly sourcePeriods = signal<AcademicPeriodRow[]>([]);
  protected readonly targetSections = signal<SectionRow[]>([]);
  protected readonly sectionDrafts = signal<SectionDraft[]>([]);
  protected readonly studentDrafts = signal<StudentDraft[]>([]);
  protected readonly sourceAssignments = signal<AssignmentRow[]>([]);
  protected readonly periodDrafts = signal<PeriodDraft[]>([]);
  protected readonly rosterCounts = signal<Record<string, number>>({});
  protected readonly periodType = signal<PeriodType>(PeriodType.Bimestre);
  protected readonly creatingYear = signal(false);
  protected readonly savingPeriods = signal(false);
  protected readonly creatingSections = signal(false);
  protected readonly loadingSource = signal(false);
  protected readonly savingEnrollments = signal(false);
  protected readonly cloningSchedule = signal(false);
  protected readonly loadingAssignmentPreview = signal(false);
  protected readonly assignmentPreviewLoaded = signal(false);
  protected readonly cloningAssignments = signal(false);
  protected readonly activating = signal(false);
  protected readonly activationCompleted = signal(false);
  protected readonly sectionsProgress = signal('');
  protected readonly enrollmentProgress = signal('');
  protected readonly assignmentCloneProgress = signal('');
  protected readonly assignmentCloneErrors = signal<string[]>([]);
  protected readonly scheduleCopied = signal(false);
  protected readonly clonedTemplateCount = signal(0);
  protected readonly clonedAssignmentCount = signal(0);
  protected readonly enrollmentCreatedCount = signal(0);
  protected readonly studentMigrationConfirmed = signal(false);
  protected readonly staffReviewConfirmed = signal(false);
  protected readonly pageError = signal('');
  protected readonly pageMessage = signal('');
  protected newYearName = '';
  protected newStartDate = '';
  protected newEndDate = '';

  protected readonly selectedStudentCount = computed(
    () =>
      this.studentDrafts().filter(
        (row) => row.include && !!row.targetSectionUuid && !row.alreadyEnrolled,
      ).length,
  );
  protected readonly configuredPeriodCount = computed(
    () => this.targetPeriods().filter((period) => period.periodType === this.periodType()).length,
  );
  protected readonly missingPeriodDrafts = computed(() => {
    const configuredOrdinals = new Set(
      this.targetPeriods()
        .filter((period) => period.periodType === this.periodType())
        .map((period) => period.ordinal),
    );
    return this.periodDrafts().filter((period) => !configuredOrdinals.has(period.ordinal));
  });
  protected readonly assignmentCloneDrafts = computed<AssignmentCloneDraft[]>(() => {
    const sectionMap = new Map(
      this.sectionDrafts()
        .filter((draft) => draft.targetSectionUuid)
        .map((draft) => [draft.source.publicUuid, draft.targetSectionUuid!]),
    );
    return this.sourceAssignments().flatMap((source) => {
      const targetSectionUuid = sectionMap.get(source.sectionPublicUuid);
      const targetPeriod = this.targetPeriods().find(
        (period) => period.periodType === source.periodType && period.ordinal === source.periodOrdinal,
      );
      return targetSectionUuid && targetPeriod
        ? [{ source, targetSectionUuid, targetPeriodUuid: targetPeriod.publicUuid }]
        : [];
    });
  });
  protected readonly activationBlockers = computed(() => {
    if (this.activationCompleted()) return [];
    const issues: string[] = [];
    if (!this.targetYearUuid()) issues.push('Crea o selecciona un año en planificación.');
    if (this.targetYear()?.status !== AcademicYearStatus.Planning)
      issues.push('El año destino debe seguir en planificación.');
    if (this.configuredPeriodCount() < PERIOD_TYPE_DIVISIONS[this.periodType()])
      issues.push(
        `Completa los ${PERIOD_TYPE_DIVISIONS[this.periodType()]} períodos de tipo ${PERIOD_TYPE_LABELS[this.periodType()]}.`,
      );
    if (this.targetSections().length === 0)
      issues.push('Crea o configura al menos una sección para el nuevo año.');
    if (!this.staffReviewConfirmed())
      issues.push('Confirma la revisión de docentes, cursos y registro de notas.');
    return issues;
  });

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await Promise.all([this.store.loadYears(), this.store.loadLevels()]);
    const active = this.years().find((year) => year.status === AcademicYearStatus.Active);
    if (active) {
      this.sourceYearUuid.set(active.publicUuid);
      this.newYearName = this.suggestNextName(active.name);
      this.newStartDate = `${this.suggestNextYearNumber(active.name)}-03-01`;
      this.newEndDate = `${this.suggestNextYearNumber(active.name)}-12-15`;
      await this.loadSourceData();
    }
  }

  protected selectTarget(uuid: string): void {
    this.targetYearUuid.set(uuid);
    this.studentMigrationConfirmed.set(false);
    this.pageError.set('');
    this.pageMessage.set('');
    if (uuid) void this.loadTargetData();
    else {
      this.targetPeriods.set([]);
      this.targetSections.set([]);
      this.periodDrafts.set([]);
      this.scheduleCopied.set(false);
      this.refreshSectionDestinations();
    }
  }

  protected selectSource(uuid: string): void {
    this.sourceYearUuid.set(uuid);
    this.studentMigrationConfirmed.set(false);
    this.scheduleCopied.set(false);
    this.clonedTemplateCount.set(0);
    this.assignmentPreviewLoaded.set(false);
    this.sourceAssignments.set([]);
    this.assignmentCloneErrors.set([]);
    this.clonedAssignmentCount.set(0);
    void this.loadSourceData();
  }

  protected async createTargetYear(): Promise<void> {
    this.clearFeedback();
    const name = this.newYearName.trim();
    if (
      name.length < 4 ||
      !this.newStartDate ||
      !this.newEndDate ||
      this.newStartDate >= this.newEndDate
    ) {
      this.pageError.set('Completa el nombre y un rango de fechas válido antes de crear el año.');
      return;
    }
    this.creatingYear.set(true);
    try {
      const created = await this.store.createYear({
        name,
        startDate: this.newStartDate,
        endDate: this.newEndDate,
      });
      if (!created) {
        this.pageError.set(this.store.error() ?? 'No se pudo crear el año.');
        return;
      }
      this.targetYearUuid.set(created.publicUuid);
      this.pageMessage.set(
        `El año ${created.name} quedó en planificación. El año actual sigue activo.`,
      );
      this.generatePeriodDrafts();
      await this.loadTargetData();
    } finally {
      this.creatingYear.set(false);
    }
  }

  protected async savePeriods(): Promise<void> {
    const year = this.targetYear();
    if (!year || this.missingPeriodDrafts().length === 0) return;
    this.clearFeedback();
    this.savingPeriods.set(true);
    try {
      const drafts = this.missingPeriodDrafts();
      for (const draft of drafts) {
        if (!draft.startDate || !draft.endDate || draft.startDate >= draft.endDate) {
          this.pageError.set(
            `Revisa las fechas de ${draft.name}; la fecha final debe ser posterior a la inicial.`,
          );
          return;
        }
      }
      const result = await this.store.createPeriodsBulk(
        year.publicUuid,
        drafts.map((period) => ({ ...period, periodType: this.periodType() })),
      );
      await this.loadTargetData();
      if (!result.success)
        this.pageError.set(
          this.store.error() ??
            `No se pudo guardar el período ${result.failedAt}. Los anteriores quedaron guardados; puedes reintentar.`,
        );
      else this.pageMessage.set(`${drafts.length} períodos guardados para ${year.name}.`);
    } finally {
      this.savingPeriods.set(false);
    }
  }

  protected changePeriodType(type: PeriodType): void {
    this.periodType.set(type);
    if (this.configuredPeriodCount() === 0) this.generatePeriodDrafts();
  }

  protected updatePeriodDraft(index: number, field: 'startDate' | 'endDate', value: string): void {
    this.periodDrafts.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  protected async setTargetGrade(
    sourceSectionUuid: string,
    targetGradeUuid: string,
  ): Promise<void> {
    this.studentMigrationConfirmed.set(false);
    this.sectionDrafts.update((rows) =>
      rows.map((row) =>
        row.source.publicUuid === sourceSectionUuid
          ? { ...row, targetGradeUuid, targetSectionUuid: undefined }
          : row,
      ),
    );
    this.refreshSectionDestinations();
  }

  protected async createTargetSections(): Promise<void> {
    const target = this.targetYear();
    if (!target) return;
    this.clearFeedback();
    this.creatingSections.set(true);
    const selected = this.sectionDrafts().filter((draft) => !!draft.targetGradeUuid);
    let done = 0;
    try {
      for (const draft of selected) {
        const existing = this.targetSections().find(
          (section) =>
            section.gradePublicUuid === draft.targetGradeUuid &&
            section.name.toLocaleLowerCase() === draft.source.name.toLocaleLowerCase(),
        );
        if (existing) {
          this.setSectionDestination(draft.source.publicUuid, existing.publicUuid);
          done++;
          this.sectionsProgress.set(`${done} de ${selected.length} secciones revisadas`);
          continue;
        }
        const request: CreateSectionRequest = {
          academicYearPublicUuid: target.publicUuid,
          gradePublicUuid: draft.targetGradeUuid,
          name: draft.source.name,
          capacity: draft.source.capacity,
          displayOrder: draft.source.displayOrder,
        };
        try {
          const created = await firstValueFrom(this.academicApi.createSection(request));
          this.targetSections.update((rows) => [...rows, created]);
          this.setSectionDestination(draft.source.publicUuid, created.publicUuid);
        } catch (error) {
          const details = errorDetails(error);
          if (details.code === 'SECTION_NAME_TAKEN') {
            await this.loadTargetData();
            const found = this.targetSections().find(
              (section) =>
                section.gradePublicUuid === draft.targetGradeUuid &&
                section.name.toLocaleLowerCase() === draft.source.name.toLocaleLowerCase(),
            );
            if (found) this.setSectionDestination(draft.source.publicUuid, found.publicUuid);
            else
              this.pageError.set(
                `No se pudo resolver la sección ${draft.source.name}: ${details.message}`,
              );
          } else {
            this.pageError.set(
              `Error al crear ${draft.source.gradeName} ${draft.source.name}: ${details.message}`,
            );
            break;
          }
        }
        done++;
        this.sectionsProgress.set(`${done} de ${selected.length} secciones revisadas`);
      }
      this.refreshStudentTargets();
      if (!this.pageError())
        this.pageMessage.set(
          `Secciones listas. Revisa y decide la matrícula de cada estudiante en el paso siguiente.`,
        );
    } finally {
      this.creatingSections.set(false);
    }
  }

  protected toggleStudent(student: StudentDraft, include: boolean): void {
    this.studentMigrationConfirmed.set(false);
    const key = `${student.sourceSectionUuid}:${student.student.studentPublicUuid}`;
    this.studentDrafts.update((rows) =>
      rows.map((row) =>
        `${row.sourceSectionUuid}:${row.student.studentPublicUuid}` === key
          ? { ...row, include }
          : row,
      ),
    );
  }

  protected toggleStudentEvent(student: StudentDraft, event: Event): void {
    this.toggleStudent(student, (event.target as HTMLInputElement).checked);
  }

  protected selectAllStudents(include: boolean): void {
    this.studentDrafts.update((rows) =>
      rows.map((row) => ({
        ...row,
        include: include && !!row.targetSectionUuid && !row.alreadyEnrolled,
      })),
    );
  }

  protected async enrollSelectedStudents(): Promise<void> {
    const year = this.targetYear();
    if (!year) return;
    this.clearFeedback();
    const selected = this.studentDrafts().filter(
      (row) => row.include && row.targetSectionUuid && !row.alreadyEnrolled,
    );
    if (selected.length === 0) return;
    this.savingEnrollments.set(true);
    let done = 0;
    let created = 0;
    try {
      for (const row of selected) {
        try {
          await firstValueFrom(
            this.studentsApi.createEnrollment(row.student.studentPublicUuid, {
              sectionPublicUuid: row.targetSectionUuid!,
              academicYearPublicUuid: year.publicUuid,
              enrolledAt: dateString(year.startDate),
              notes: `Matrícula preparada desde el año ${this.sourceYear()?.name ?? 'anterior'}.`,
            }),
          );
          this.updateStudentResult(row, 'created', 'Matrícula creada.');
          created++;
        } catch (error) {
          const details = errorDetails(error);
          const duplicate = details.code === 'STUDENT_ALREADY_ENROLLED';
          this.updateStudentResult(
            row,
            duplicate ? 'skipped' : 'error',
            duplicate ? 'Ya tiene matrícula activa en el año destino.' : details.message,
            duplicate,
          );
        }
        done++;
        this.enrollmentProgress.set(`${done} de ${selected.length} estudiantes procesados`);
      }
      this.enrollmentCreatedCount.update((count) => count + created);
      const pendingErrors = this.studentDrafts().some(
        (row) => row.result === 'error' && row.include,
      );
      this.studentMigrationConfirmed.set(!pendingErrors);
      this.pageMessage.set(
        `${created} matrícula(s) nueva(s); las filas con error quedan marcadas para corregir o reintentar.`,
      );
      await this.loadTargetData();
      this.refreshStudentTargets();
    } finally {
      this.savingEnrollments.set(false);
    }
  }

  protected async cloneDayTemplates(): Promise<void> {
    const target = this.targetYearUuid();
    const source = this.sourceYearUuid();
    if (!target || !source) return;
    this.clearFeedback();
    this.cloningSchedule.set(true);
    try {
      const templates = await firstValueFrom(
        this.scheduleApi.cloneSchedule(target, { sourceYearUuid: source, includeTimeSlots: false }),
      );
      this.clonedTemplateCount.set(templates.length);
      this.scheduleCopied.set(true);
      this.pageMessage.set(
        `${templates.length} plantilla(s) de jornada quedaron disponibles en el año destino.`,
      );
    } catch (error) {
      this.pageError.set(errorDetails(error).message);
    } finally {
      this.cloningSchedule.set(false);
    }
  }

  protected async analyzeTeacherAssignments(): Promise<void> {
    const sectionUuids = new Set(this.sectionDrafts().map((draft) => draft.source.publicUuid));
    const periodUuids = new Set(this.sourcePeriods().map((period) => period.publicUuid));
    if (sectionUuids.size === 0 || periodUuids.size === 0) {
      this.sourceAssignments.set([]);
      this.assignmentPreviewLoaded.set(true);
      return;
    }
    this.loadingAssignmentPreview.set(true);
    this.assignmentCloneErrors.set([]);
    try {
      const assignments = await firstValueFrom(
        this.teachersApi.listTenantAssignments({ active: true }),
      );
      this.sourceAssignments.set(
        assignments.filter(
          (assignment) =>
            sectionUuids.has(assignment.sectionPublicUuid) &&
            periodUuids.has(assignment.academicPeriodPublicUuid),
        ),
      );
      this.assignmentPreviewLoaded.set(true);
      this.pageMessage.set(
        `Encontramos ${this.sourceAssignments().length} asignación(es) en el año de referencia.`,
      );
    } catch (error) {
      this.pageError.set(errorDetails(error).message);
    } finally {
      this.loadingAssignmentPreview.set(false);
    }
  }

  protected async cloneTeacherAssignments(): Promise<void> {
    const drafts = this.assignmentCloneDrafts();
    if (drafts.length === 0) return;
    this.cloningAssignments.set(true);
    this.assignmentCloneErrors.set([]);
    let created = 0;
    let skipped = 0;
    const failures: string[] = [];
    try {
      for (let index = 0; index < drafts.length; index++) {
        const draft = drafts[index];
        try {
          await firstValueFrom(
            this.teachersApi.createAssignment(draft.source.teacherPublicUuid, {
              sectionPublicUuid: draft.targetSectionUuid,
              coursePublicUuid: draft.source.coursePublicUuid,
              academicPeriodPublicUuid: draft.targetPeriodUuid,
              notes: `Copiada desde el año ${this.sourceYear()?.name ?? 'anterior'}; revisar antes de iniciar clases.`,
            }),
          );
          created++;
        } catch (error) {
          const details = errorDetails(error);
          if (details.code === 'ASSIGNMENT_ALREADY_ACTIVE') skipped++;
          else failures.push(`${draft.source.teacherFullName} · ${draft.source.sectionName} · ${draft.source.courseCode}: ${details.message}`);
        }
        this.assignmentCloneProgress.set(`${index + 1} de ${drafts.length} asignaciones procesadas`);
      }
      this.clonedAssignmentCount.update((count) => count + created);
      this.assignmentCloneErrors.set(failures);
      this.pageMessage.set(
        `${created} asignación(es) copiadas, ${skipped} ya existentes y ${failures.length} con error. Revisa los errores antes de iniciar clases.`,
      );
    } finally {
      this.cloningAssignments.set(false);
    }
  }

  protected async activateNewYear(): Promise<void> {
    const year = this.targetYear();
    if (!year || this.activationBlockers().length > 0) return;
    const current = this.years().find((item) => item.status === AcademicYearStatus.Active);
    const ok = await this.confirmDialog.open({
      title: 'Activar el nuevo año académico',
      message: current
        ? `Al activar "${year.name}", el año "${current.name}" quedará cerrado y no podrá editarse ni reabrirse. ¿Ya revisaste la configuración y deseas continuar?`
        : `¿Activar "${year.name}"?`,
      confirmLabel: 'Activar y cerrar año anterior',
      variant: 'warning',
    });
    if (!ok) return;
    this.activating.set(true);
    this.clearFeedback();
    try {
      const activated = await this.store.activateYear(year.publicUuid);
      if (!activated) {
        this.pageError.set(this.store.error() ?? 'No se pudo activar el año.');
        return;
      }
      this.pageMessage.set(
        `${activated.name} quedó activo. El año anterior se cerró correctamente.`,
      );
      this.activationCompleted.set(true);
      await this.store.loadYears();
      this.step.set(4);
    } finally {
      this.activating.set(false);
    }
  }

  protected confirmNoStudentMigration(): void {
    this.studentMigrationConfirmed.set(true);
    this.pageMessage.set('Confirmaste continuar sin copiar las matrículas que quedan pendientes.');
  }

  protected targetSectionName(draft: SectionDraft): string {
    const grade = this.levels()
      .flatMap((level) => level.grades)
      .find((item) => item.publicUuid === draft.targetGradeUuid);
    return grade ? `${grade.name} ${draft.source.name}` : 'sin sección destino';
  }

  protected statusLabel(status: AcademicYearStatus): string {
    if (status === AcademicYearStatus.Active) return 'Activo';
    if (status === AcademicYearStatus.Closed) return 'Cerrado';
    return 'En planificación';
  }

  protected goToStep(target: number): void {
    if (target <= this.step()) this.step.set(target);
    else if (this.canAdvance() && target === this.step() + 1) this.step.set(target);
  }

  protected previousStep(): void {
    this.step.update((current) => Math.max(0, current - 1));
  }

  protected nextStep(): void {
    if (this.canAdvance()) this.step.update((current) => Math.min(4, current + 1));
  }

  protected canAdvance(): boolean {
    switch (this.step()) {
      case 0:
        return (
          !!this.targetYearUuid() &&
          this.configuredPeriodCount() >= PERIOD_TYPE_DIVISIONS[this.periodType()]
        );
      case 1:
        return this.targetSections().length > 0;
      case 2:
        return this.studentMigrationConfirmed();
      case 3:
        return this.staffReviewConfirmed();
      default:
        return false;
    }
  }

  private async loadTargetData(): Promise<void> {
    const uuid = this.targetYearUuid();
    if (!uuid) return;
    this.clearFeedback();
    try {
      const [periods, sections] = await Promise.all([
        firstValueFrom(this.academicApi.listPeriods({ academicYearPublicUuid: uuid })),
        firstValueFrom(this.academicApi.listSections({ academicYearPublicUuid: uuid })),
      ]);
      this.targetPeriods.set(periods);
      this.targetSections.set(sections);
      if (periods.length > 0) this.periodType.set(periods[0].periodType);
      if (this.configuredPeriodCount() < PERIOD_TYPE_DIVISIONS[this.periodType()])
        this.generatePeriodDrafts();
      this.refreshSectionDestinations();
      await this.loadTargetRosters(sections);
    } catch (error) {
      this.pageError.set(errorDetails(error).message);
    }
  }

  private async loadSourceData(): Promise<void> {
    const uuid = this.sourceYearUuid();
    this.loadingSource.set(true);
    this.sectionDrafts.set([]);
    this.studentDrafts.set([]);
    this.sourcePeriods.set([]);
    this.sourceAssignments.set([]);
    this.assignmentPreviewLoaded.set(false);
    this.rosterCounts.set({});
    if (!uuid) {
      this.loadingSource.set(false);
      return;
    }
    try {
      const [sections, periods] = await Promise.all([
        firstValueFrom(this.academicApi.listSections({ academicYearPublicUuid: uuid })),
        firstValueFrom(this.academicApi.listPeriods({ academicYearPublicUuid: uuid })),
      ]);
      this.sourcePeriods.set(periods);
      const rosterEntries = await Promise.all(
        sections.map(async (section) => ({
          section,
          roster: await firstValueFrom(this.studentsApi.listSectionRoster(section.publicUuid)),
        })),
      );
      this.rosterCounts.set(
        Object.fromEntries(
          rosterEntries.map(({ section, roster }) => [section.publicUuid, roster.length]),
        ),
      );
      const drafts = sections.map((source) => {
        const level = this.levels().find((item) => item.publicUuid === source.levelPublicUuid);
        const nextGrade = level?.grades.find((grade) => grade.ordinal === source.gradeOrdinal + 1);
        return { source, targetGradeUuid: nextGrade?.publicUuid ?? '' };
      });
      this.sectionDrafts.set(drafts);
      this.studentDrafts.set(
        rosterEntries.flatMap(({ section, roster }) =>
          roster.map((student) => ({
            student,
            sourceSectionUuid: section.publicUuid,
            include: false,
            alreadyEnrolled: false,
          })),
        ),
      );
      this.refreshSectionDestinations();
      this.refreshStudentTargets();
    } catch (error) {
      this.pageError.set(errorDetails(error).message);
    } finally {
      this.loadingSource.set(false);
    }
  }

  private async loadTargetRosters(sections: SectionRow[]): Promise<void> {
    const enrolled = new Set<string>();
    await Promise.all(
      sections.map(async (section) => {
        try {
          const roster = await firstValueFrom(
            this.studentsApi.listSectionRoster(section.publicUuid),
          );
          for (const row of roster) enrolled.add(`${section.publicUuid}:${row.studentPublicUuid}`);
        } catch {
          // The section remains usable for setup; the backend remains authoritative on enrollment.
        }
      }),
    );
    this.studentDrafts.update((rows) =>
      rows.map((row) => {
        const destination = this.sectionDrafts().find(
          (draft) => draft.source.publicUuid === row.sourceSectionUuid,
        )?.targetSectionUuid;
        const alreadyEnrolled =
          !!destination && enrolled.has(`${destination}:${row.student.studentPublicUuid}`);
        return {
          ...row,
          targetSectionUuid: destination,
          targetSectionName: sections.find((section) => section.publicUuid === destination)?.name,
          alreadyEnrolled,
          include: alreadyEnrolled ? false : row.include,
        };
      }),
    );
  }

  private refreshSectionDestinations(): void {
    this.sectionDrafts.update((rows) =>
      rows.map((draft) => {
        const target = this.targetSections().find(
          (section) =>
            section.gradePublicUuid === draft.targetGradeUuid &&
            section.name.toLocaleLowerCase() === draft.source.name.toLocaleLowerCase(),
        );
        return { ...draft, targetSectionUuid: target?.publicUuid };
      }),
    );
    this.refreshStudentTargets();
  }

  private refreshStudentTargets(): void {
    const draftBySource = new Map(
      this.sectionDrafts().map((draft) => [draft.source.publicUuid, draft]),
    );
    this.studentDrafts.update((rows) =>
      rows.map((row) => {
        const section = draftBySource.get(row.sourceSectionUuid);
        const targetSection = this.targetSections().find(
          (item) => item.publicUuid === section?.targetSectionUuid,
        );
        const targetSectionUuid = section?.targetSectionUuid;
        const targetSectionName = targetSection
          ? `${targetSection.gradeName} ${targetSection.name}`
          : undefined;
        const changedDestination = row.targetSectionUuid !== targetSectionUuid;
        return {
          ...row,
          targetSectionUuid,
          targetSectionName,
          include: changedDestination ? !!targetSectionUuid : row.include,
          alreadyEnrolled: changedDestination ? false : row.alreadyEnrolled,
        };
      }),
    );
  }

  private setSectionDestination(sourceUuid: string, targetUuid: string): void {
    this.sectionDrafts.update((rows) =>
      rows.map((row) =>
        row.source.publicUuid === sourceUuid ? { ...row, targetSectionUuid: targetUuid } : row,
      ),
    );
  }

  private updateStudentResult(
    student: StudentDraft,
    result: StudentDraft['result'],
    message: string,
    duplicate = false,
  ): void {
    const key = `${student.sourceSectionUuid}:${student.student.studentPublicUuid}`;
    this.studentDrafts.update((rows) =>
      rows.map((row) =>
        `${row.sourceSectionUuid}:${row.student.studentPublicUuid}` === key
          ? {
              ...row,
              result,
              resultMessage: message,
              alreadyEnrolled: duplicate,
              include: duplicate ? false : row.include,
            }
          : row,
      ),
    );
  }

  private generatePeriodDrafts(): void {
    const year = this.targetYear();
    if (!year) return;
    const count = PERIOD_TYPE_DIVISIONS[this.periodType()];
    const first = dateAtUtc(dateString(year.startDate));
    const last = dateAtUtc(dateString(year.endDate));
    const dayCount = Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
    if (dayCount < count) {
      this.periodDrafts.set([]);
      return;
    }
    const drafts: PeriodDraft[] = [];
    for (let i = 0; i < count; i++) {
      const startOffset = Math.floor((dayCount * i) / count);
      const nextOffset = Math.floor((dayCount * (i + 1)) / count);
      const start = new Date(first.getTime() + startOffset * 86_400_000);
      const end = new Date(first.getTime() + (nextOffset - 1) * 86_400_000);
      drafts.push({
        ordinal: i + 1,
        name: `${PERIOD_TYPE_LABELS[this.periodType()]} ${i + 1}`,
        startDate: dateString(start),
        endDate: dateString(end),
      });
    }
    this.periodDrafts.set(drafts);
  }

  private suggestNextName(current: string): string {
    const match = current.match(/(\d{4})/);
    return match ? current.replace(match[1], String(Number(match[1]) + 1)) : `${current} siguiente`;
  }

  private suggestNextYearNumber(current: string): number {
    const match = current.match(/(\d{4})/);
    return match ? Number(match[1]) + 1 : new Date().getUTCFullYear() + 1;
  }

  private sourceYear(): AcademicYearRow | null {
    return this.years().find((year) => year.publicUuid === this.sourceYearUuid()) ?? null;
  }

  private clearFeedback(): void {
    this.pageError.set('');
    this.pageMessage.set('');
  }
}

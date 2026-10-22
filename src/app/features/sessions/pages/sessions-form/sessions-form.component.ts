import { createFormProtection } from '@shared/services/form-protection.service';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES, API } from '@core/constants';
import { AuthService } from '@core/services';
import {
  PageContainerComponent,
  PageHeaderComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';
import { RouterLink } from '@angular/router';
import { SessionsApiService } from '../../services';
import { AcademicApiService } from '@features/academic/services';
import { SessionTemplatesApiService } from '@features/academic/services/session-templates-api.service';
import {
  CreateLearningSessionRequest,
  UpdateLearningSessionRequest,
  LearningSessionDetail,
  SessionStatus,
  ApplicationSheetKind,
  ApplicationSheetView,
  GenerateApplicationSheetRequest,
} from '../../models';
import { AiPanelComponent } from '@features/ai/components/ai-panel';
import { ApplicationSheetPreviewComponent } from '../../components/application-sheet-preview.component';
import { SessionTemplateDetail } from '@features/academic/models/session-template.model';
import { AcademicYearStatus } from '@features/academic/models/academic-year.model';
import {
  AcademicPeriodRow,
  formatPeriodLabel,
  resolveCurrentAcademicPeriod,
} from '@features/academic/models/period.model';

/**
 * `/learning-sessions/new` y `/learning-sessions/:id/edit`
 *
 * <h3>Características</h3>
 * <ul>
 *   <li>Tres pasos: contexto de la clase, competencias y desarrollo.</li>
 *   <li>Editor de contenido: Objetivo, momentos (inicio/desarrollo/cierre),
 *       materiales y notas.</li>
 *   <li>Modo solo lectura si el estado es COMPLETED o CANCELLED.</li>
 *   <li>Botones de lifecycle (Iniciar, Completar, Cancelar) en modo edición.</li>
 * </ul>
 */
@Component({
  selector: 'app-sessions-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    AiPanelComponent,
    ApplicationSheetPreviewComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Sesiones de aprendizaje"
        [title]="isEdit() ? 'Editar sesión' : 'Nueva sesión'"
        [subtitle]="headerSubtitle()"
      >
        <a [routerLink]="ROUTES.SESSIONS.LIST" class="btn btn-ghost btn-sm">
          <app-icon name="arrow-left" [size]="16" />
          <span>Volver</span>
        </a>
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando datos…" />
        </div>
      } @else {
        <form [formGroup]="form" class="grid gap-6">
          <div #stepAnchor></div>
          <nav aria-label="Pasos para planificar la sesión" class="grid grid-cols-3 gap-2">
            @for (item of steps; track item.id) {
              <button
                type="button"
                class="rounded-xl border px-3 py-2.5 text-left transition"
                [class.border-primary-600]="step() === item.id"
                [class.bg-surface]="step() === item.id"
                [class.ring-1]="step() === item.id"
                [class.ring-primary-600]="step() === item.id"
                [class.border-border-subtle]="step() !== item.id"
                [class.bg-surface-subtle]="step() !== item.id"
                [attr.aria-current]="step() === item.id ? 'step' : null"
                (click)="goToStep(item.id)"
              >
                <span class="block text-[11px] font-medium uppercase tracking-wide text-content-muted">
                  Paso {{ item.id }}
                </span>
                <span class="mt-0.5 block text-sm font-semibold text-content">{{ item.label }}</span>
                <span class="mt-0.5 hidden text-xs text-content-muted sm:block">{{ item.caption }}</span>
              </button>
            }
          </nav>

          <!-- Paso 1: contexto -->
          <section class="card" [class.hidden]="step() !== 1">
            <header class="card-header">
              <div class="min-w-0">
                <h3 class="card-title">¿Para qué clase es?</h3>
                <p class="mt-1 text-sm text-content-muted">
                  Curso, fecha y título. El resto de la sesión se arma a partir de esto.
                </p>
              </div>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-2">
              @if (periodOptions().length > 0) {
                <div class="field sm:col-span-2">
                  <label class="label" for="session-period">Periodo *</label>
                  <select
                    id="session-period"
                    class="select"
                    [ngModel]="selectedPeriodUuid()"
                    [ngModelOptions]="{ standalone: true }"
                    [disabled]="isEdit() || isReadOnly()"
                    (ngModelChange)="onPeriodChange($event)"
                  >
                    @for (p of periodOptions(); track p.publicUuid) {
                      <option [ngValue]="p.publicUuid">{{ periodOptionLabel(p) }}</option>
                    }
                  </select>
                  <p class="mt-1 text-xs text-content-muted">
                    Arranca en el periodo vigente. Cámbialo solo si planificas otro bimestre.
                  </p>
                </div>
              }

              <div class="field sm:col-span-2">
                <label class="label" for="session-assignment">Clase *</label>
                <p class="mb-1.5 text-xs text-content-muted">Docente, curso, grado y sección.</p>
                <select
                  id="session-assignment"
                  class="select"
                  formControlName="assignmentUuid"
                  [disabled]="isEdit() || isReadOnly()"
                >
                  <option value="">Selecciona una asignación...</option>
                  @for (a of filteredAssignments(); track a.publicUuid) {
                    <option [value]="a.publicUuid">
                      {{ assignmentOptionLabel(a) }}
                    </option>
                  }
                </select>
                @if (filteredAssignments().length === 0 && selectedPeriodUuid()) {
                  <p class="mt-1 text-xs text-content-muted">
                    No hay asignaciones activas en este periodo.
                  </p>
                }
                @if (form.get('assignmentUuid')?.invalid && form.get('assignmentUuid')?.touched) {
                  <p class="field-error">Elige la clase.</p>
                }
                @if (selectedAssignmentPreview(); as row) {
                  <dl class="mt-3 grid gap-3 rounded-xl border border-border-subtle bg-surface-subtle p-3 sm:grid-cols-3">
                    <div>
                      <dt class="text-xs text-content-muted">Docente</dt>
                      <dd class="text-sm font-medium text-content">{{ row.teacherFullName || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-content-muted">Curso</dt>
                      <dd class="text-sm font-medium text-content">{{ row.courseName || row.courseCode || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-content-muted">Grado y sección</dt>
                      <dd class="text-sm font-medium text-content">
                        {{ row.gradeName || '—' }} · {{ row.sectionName || '—' }}
                      </dd>
                    </div>
                  </dl>
                }
              </div>

              <div class="field sm:col-span-2">
                <label class="label" for="session-title">Título *</label>
                <input
                  id="session-title"
                  type="text"
                  class="input"
                  formControlName="title"
                  placeholder="Ej: Introducción a las fracciones"
                  [disabled]="isReadOnly()"
                />
                @if (form.get('title')?.invalid && form.get('title')?.touched) {
                  <p class="field-error">Escribe el título de la sesión.</p>
                }
              </div>

              <div class="field">
                <label class="label" for="session-unit">Unidad *</label>
                <select
                  id="session-unit"
                  class="select"
                  formControlName="unitUuid"
                  [disabled]="!selectedCourseUuid() || isReadOnly()"
                >
                  <option value="">Selecciona una unidad...</option>
                  @for (u of units(); track u.publicUuid) {
                    <option [value]="u.publicUuid">{{ u.displayOrder }}. {{ u.name }}</option>
                  }
                </select>
                @if (!selectedCourseUuid()) {
                  <p class="mt-1 text-xs text-content-muted">Aparece al elegir la clase.</p>
                }
                @if (form.get('unitUuid')?.invalid && form.get('unitUuid')?.touched) {
                  <p class="field-error">Elige la unidad.</p>
                }
              </div>

              <div class="field">
                <label class="label" for="session-date">Fecha *</label>
                <input
                  id="session-date"
                  type="date"
                  class="input"
                  formControlName="scheduledDate"
                  [disabled]="isReadOnly()"
                />
                @if (form.get('scheduledDate')?.invalid && form.get('scheduledDate')?.touched) {
                  <p class="field-error">Elige la fecha.</p>
                }
              </div>

              <div class="field sm:col-span-2">
                <label class="label" for="session-duration">Duración *</label>
                <div class="flex flex-wrap items-center gap-2">
                  @for (minutes of durationPresets; track minutes) {
                    <button
                      type="button"
                      class="btn btn-sm"
                      [class.btn-primary]="durationIs(minutes)"
                      [class.btn-ghost]="!durationIs(minutes)"
                      [disabled]="isReadOnly()"
                      (click)="setDuration(minutes)"
                    >
                      {{ minutes }} min
                    </button>
                  }
                  <input
                    id="session-duration"
                    type="number"
                    class="input w-28"
                    formControlName="durationMinutes"
                    min="1"
                    max="480"
                    [disabled]="isReadOnly()"
                  />
                </div>
                @if (form.get('durationMinutes')?.invalid && form.get('durationMinutes')?.touched) {
                  <p class="field-error">Entre 1 y 480 minutos.</p>
                }
              </div>

              @if (!isEdit()) {
                <div class="field sm:col-span-2">
                  <label class="label" for="session-template">Plantilla</label>
                  <select
                    id="session-template"
                    class="select"
                    formControlName="templateUuid"
                    [disabled]="isReadOnly()"
                    (change)="onTemplateSelected()"
                  >
                    <option value="">Sin plantilla — escribo el desarrollo yo</option>
                    @for (t of sessionTemplates(); track t.publicUuid) {
                      <option [value]="t.publicUuid">
                        {{ t.name }}@if (t.isDefault) { (predeterminada)}
                      </option>
                    }
                  </select>
                  <p class="mt-1 text-xs text-content-muted">
                    Si aún no hay actividades, la plantilla propone los momentos de la clase.
                  </p>
                </div>
              }
            </div>
          </section>

          <!-- Paso 2: competencias -->
          <section class="card" [class.hidden]="step() !== 2">
            <header class="card-header">
              <div class="flex w-full flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="card-title">¿Qué se trabaja?</h3>
                  <p class="mt-1 text-sm text-content-muted">
                    Marca las competencias de esta clase. Puedes seguir sin marcar ninguna.
                  </p>
                </div>
                @if (selectedCompetencies().size > 0) {
                  <span class="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-content">
                    {{ selectedCompetencies().size }}
                    {{ selectedCompetencies().size === 1 ? 'competencia' : 'competencias' }}
                  </span>
                }
              </div>
            </header>
            <div class="card-body">
              @if (selectedCourseUuid() && !isReadOnly()) {
                @if (!addingCompetency()) {
                  <button
                    type="button"
                    class="btn btn-outline btn-sm mb-4"
                    [disabled]="saving()"
                    (click)="openAddCompetency()"
                  >
                    Agregar competencia
                  </button>
                } @else {
                  <div class="mb-4 rounded-xl border border-border-subtle bg-surface-subtle p-3">
                    <label class="mb-2 block text-sm font-medium text-content">
                      Nombre de la competencia
                      <input
                        type="text"
                        class="form-input mt-1"
                        [value]="draftCompetencyName()"
                        (input)="draftCompetencyName.set($any($event.target).value)"
                        maxlength="300"
                      />
                    </label>
                    <p class="mb-2 text-xs text-content-muted">Al menos una capacidad.</p>
                    <div class="space-y-2">
                      @for (cap of draftCapacities(); track $index) {
                        <input
                          type="text"
                          class="form-input"
                          [value]="cap"
                          (input)="setDraftCapacity($index, $any($event.target).value)"
                          placeholder="Capacidad"
                          maxlength="300"
                        />
                      }
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="addDraftCapacity()">
                        Otra capacidad
                      </button>
                      <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        [disabled]="saving()"
                        (click)="saveDraftCompetency()"
                      >
                        Guardar
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm" (click)="cancelAddCompetency()">
                        Cancelar
                      </button>
                    </div>
                    @if (competencyActionError()) {
                      <p class="mt-2 text-xs text-red-600">{{ competencyActionError() }}</p>
                    }
                  </div>
                }
              }
              @if (competencyActionError() && !addingCompetency()) {
                <p class="mb-3 text-xs text-red-600">{{ competencyActionError() }}</p>
              }
              @if (!selectedCourseUuid()) {
                <p class="text-sm text-content-muted">
                  Vuelve al paso Contexto y elige la clase para ver sus competencias.
                </p>
              } @else if (competencies().length === 0) {
                <p class="text-sm text-content-muted">
                  Este curso aún no tiene competencias. Agrega la primera para marcarla en esta clase,
                  o continúa y completa el desarrollo.
                </p>
              } @else {
                <div class="space-y-4">
                  @for (comp of competencies(); track comp.publicUuid) {
                    <div class="rounded-xl border border-border-subtle bg-surface-subtle p-3">
                      <label class="flex items-start gap-2 font-medium text-content">
                        <input
                          type="checkbox"
                          class="form-checkbox mt-1"
                          [value]="comp.publicUuid"
                          [checked]="isCompetencySelected(comp.publicUuid)"
                          (change)="toggleCompetency(comp.publicUuid, $event)"
                          [disabled]="isReadOnly()"
                        />
                        <span class="min-w-0 flex-1">{{ comp.code }} — {{ comp.name }}</span>
                      </label>
                      @if (canDeactivateCompetency(comp)) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm mt-2 text-content-muted"
                          [disabled]="saving()"
                          (click)="deactivateCompetency(comp)"
                        >
                          Desactivar
                        </button>
                      }

                      @if (isCompetencySelected(comp.publicUuid) && comp.capacities.length > 0) {
                        <div class="ml-6 mt-2 space-y-1 border-l-2 border-border-subtle pl-3">
                          @for (cap of comp.capacities; track cap.publicUuid) {
                            <label class="flex items-center gap-2 text-sm text-content-muted">
                              <input
                                type="checkbox"
                                class="form-checkbox"
                                [value]="cap.publicUuid"
                                [checked]="isCapacitySelected(cap.publicUuid)"
                                (change)="toggleCapacity(cap.publicUuid, $event)"
                                [disabled]="isReadOnly()"
                              />
                              <span>{{ cap.code }} — {{ cap.name }}</span>
                            </label>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </section>

          <div class="grid gap-6" [class.hidden]="step() !== 3">
            @if (!isReadOnly() && !isEdit()) {
              <app-ai-panel
                title="Generar el desarrollo con IA"
                subtitle="Usa el título, la unidad y las competencias que ya elegiste. Puedes editar todo antes de guardar."
                triggerLabel="Generar borrador"
                [idleHint]="'Completa título, objetivo, inicio, desarrollo, cierre y materiales.'"
                [draftSummary]="aiDraftSummary()"
                [endpoint]="API.AI.GENERATE_SESSION_STREAM"
                [requestBody]="aiSessionRequestBody()"
                [parse]="parseSessionDraft"
                (done)="applySessionDraft($event)"
                (failed)="onAiError($event)"
              />
              <div class="card">
                <div class="card-body grid gap-3">
                  <label class="flex items-start gap-2 text-sm text-content">
                    <input
                      type="checkbox"
                      class="checkbox mt-0.5"
                      [checked]="wantApplicationSheet()"
                      (change)="wantApplicationSheet.set($any($event.target).checked)"
                    />
                    <span>
                      <span class="font-medium">También generar ficha de aplicación</span>
                      <span class="mt-0.5 block text-content-muted">
                        Se crea al generar el borrador, una ficha por grado.
                      </span>
                    </span>
                  </label>
                  @if (wantApplicationSheet()) {
                    <div class="grid gap-3 rounded-xl border border-border-subtle bg-surface-subtle p-3">
                      <label class="flex items-start gap-2 text-sm text-content">
                        <input
                          type="checkbox"
                          class="checkbox mt-0.5"
                          [checked]="includeDiagnostic()"
                          (change)="includeDiagnostic.set($any($event.target).checked)"
                        />
                        <span>Incluir una ficha de evaluación diagnóstica, del mismo grado.</span>
                      </label>
                      <p class="text-sm text-content">
                        Grado:
                        <span class="font-medium">{{ primaryGrade() || 'la clase no trae grado' }}</span>
                      </p>
                      <label class="block text-sm text-content">
                        Otro grado
                        <span class="mt-0.5 block text-xs text-content-muted">
                          Genera una ficha adicional. No agrega una columna a la misma ficha.
                        </span>
                        <input
                          class="input mt-1 w-full"
                          [ngModel]="extraGrade()"
                          (ngModelChange)="extraGrade.set($event)"
                          [ngModelOptions]="{ standalone: true }"
                          placeholder="Ej. 4.to Grado"
                        />
                      </label>
                    </div>
                  }
                </div>
              </div>
            }

            <section class="card">
              <header class="card-header">
                <div class="min-w-0">
                  <h3 class="card-title">Cómo se desarrolla la clase</h3>
                  <p class="mt-1 text-sm text-content-muted">
                    Objetivo, momentos y materiales. Lo que el docente lleva al aula.
                  </p>
                </div>
              </header>
              <div class="card-body grid gap-6">
                <div class="field">
                  <label class="label" for="session-objective">Objetivo *</label>
                  <textarea
                    id="session-objective"
                    class="input"
                    rows="3"
                    formControlName="objective"
                    placeholder="Qué lograrán los estudiantes al terminar la sesión."
                    [disabled]="isReadOnly()"
                  ></textarea>
                  @if (form.get('objective')?.invalid && form.get('objective')?.touched) {
                    <p class="field-error">Escribe el objetivo.</p>
                  }
                  @if (wantApplicationSheet() && !isEdit()) {
                    <div class="mt-3 grid gap-3">
                      <p class="text-sm font-medium text-content">
                        Fichas de aplicación · {{ primaryGrade() || 'sin grado' }}
                      </p>
                      @if (sheetsLoading()) {
                        <p class="text-xs text-content-muted">Generando fichas…</p>
                      }
                      @if (sheetError()) {
                        <p class="text-xs text-red-600">{{ sheetError() }}</p>
                      }
                      @for (sheet of sheetDrafts(); track sheet.kind + sheet.grade) {
                        <app-application-sheet-preview
                          [sheet]="sheet"
                          (sheetChange)="replaceSheet($event)"
                        />
                      }
                    </div>
                  }
                </div>

                <div class="field">
                  <div class="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p class="label mb-0">Momentos de la clase</p>
                      <p class="text-xs text-content-muted">Inicio, desarrollo y cierre.</p>
                    </div>
                    @if (!isReadOnly()) {
                      <div class="flex flex-wrap gap-2">
                        <button type="button" class="btn btn-ghost btn-sm" (click)="addPhaseActivity('INICIO')">
                          + Inicio
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm" (click)="addPhaseActivity('DESARROLLO')">
                          + Desarrollo
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm" (click)="addPhaseActivity('CIERRE')">
                          + Cierre
                        </button>
                      </div>
                    }
                  </div>
                  <div formArrayName="activities" class="space-y-3">
                    @for (activity of activitiesArray.controls; track $index; let i = $index) {
                      <div class="rounded-xl border border-border-subtle p-3">
                        <div class="mb-2 flex items-center justify-between gap-2">
                          <span class="text-xs font-semibold uppercase tracking-wide text-content-muted">
                            {{ activityPhaseLabel(activity.value) || 'Momento ' + (i + 1) }}
                          </span>
                          @if (!isReadOnly()) {
                            <button
                              type="button"
                              class="btn btn-ghost btn-sm text-red-600"
                              (click)="removeActivity(i)"
                            >
                              <app-icon name="trash-2" [size]="16" />
                            </button>
                          }
                        </div>
                        <textarea
                          rows="5"
                          class="input min-h-28 w-full"
                          [formControl]="$any(activity)"
                          placeholder="Qué hace el docente y qué hacen los estudiantes."
                          [disabled]="isReadOnly()"
                        ></textarea>
                      </div>
                    } @empty {
                      <p class="text-sm text-content-muted">
                        Aún no hay momentos. Agrégalos arriba o genera un borrador con IA.
                      </p>
                    }
                  </div>
                </div>

                <div class="field">
                  <label class="label">Materiales</label>
                  <p class="mb-2 text-xs text-content-muted">Lo que hay que tener listo antes de entrar al aula.</p>
                  <div formArrayName="materials" class="space-y-2">
                    @for (material of materialsArray.controls; let i = $index; track i) {
                      <div class="flex gap-2">
                        <input
                          type="text"
                          class="input flex-1"
                          [formControlName]="i"
                          placeholder="Ej: Proyector, fichas impresas"
                          [disabled]="isReadOnly()"
                        />
                        @if (!isReadOnly()) {
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm text-red-600"
                            (click)="removeMaterial(i)"
                          >
                            <app-icon name="trash-2" [size]="16" />
                          </button>
                        }
                      </div>
                    }
                  </div>
                  @if (!isReadOnly()) {
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm mt-2 text-primary-600"
                      (click)="addMaterial()"
                    >
                      <app-icon name="plus" [size]="16" />
                      <span>Añadir material</span>
                    </button>
                  }
                </div>

                <div class="field">
                  <label class="label" for="session-notes">Notas para el docente</label>
                  <p class="mb-2 text-xs text-content-muted">
                    Recordatorios internos. No forman parte de lo que se comparte como objetivo.
                  </p>
                  <textarea
                    id="session-notes"
                    class="input"
                    rows="3"
                    formControlName="observations"
                    placeholder="Ej: traer las fichas impresas del salón de al lado."
                    [disabled]="isReadOnly()"
                  ></textarea>
                </div>
              </div>
            </section>
          </div>

          @if (errorMessage()) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ errorMessage() }}</p>
            </div>
          }

          <div
            class="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface/95 px-4 py-3 shadow-sm backdrop-blur"
          >
            <div class="min-w-0 text-sm text-content-muted">
              <p>Paso {{ step() }} de 3</p>
              @if (showStepErrors() && continueHint()) {
                <p class="text-red-600">{{ continueHint() }}</p>
              }
            </div>
            <div class="flex flex-wrap items-center gap-2">
              @if (step() > 1) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="prevStep()">Atrás</button>
              }
              @if (isEdit() && !isReadOnly() && step() < 3) {
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  [disabled]="saving()"
                  (click)="onSubmit()"
                >
                  Guardar
                </button>
              }
              @if (step() < 3) {
                <button type="button" class="btn btn-primary btn-sm" (click)="nextStep()">Continuar</button>
              } @else if (!isReadOnly()) {
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="saving()"
                  (click)="onSubmit()"
                >
                  <app-icon name="check" [size]="16" />
                  <span>{{ saving() ? 'Guardando…' : isEdit() ? 'Guardar cambios' : 'Crear sesión' }}</span>
                </button>
              }
            </div>
          </div>
        </form>
      }
    </app-page-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .field-error {
        @apply mt-1 text-xs text-red-600;
      }
    `,
  ],
})
export class SessionsFormComponent implements OnInit {
  protected readonly formProtection = createFormProtection({
    snapshot: () => [this.form.getRawValue(), this.draftCompetencyName(), this.draftCapacities(), this.sheetDrafts()],
    saving: () => this.saving(),
    active: () => !this.loading(),
  });

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(SessionsApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly templatesApi = inject(SessionTemplatesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly ROUTES = ROUTES;
  protected readonly API = API;

  protected readonly form: FormGroup = this.fb.group({
    assignmentUuid: ['', Validators.required],
    unitUuid: ['', Validators.required],
    scheduledDate: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    durationMinutes: [90, [Validators.required, Validators.min(1), Validators.max(480)]],
    objective: ['', Validators.required],
    observations: [''],
    activities: this.fb.array([]),
    materials: this.fb.array([]),
    templateUuid: [''],
  });

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly assignments = signal<any[]>([]);
  protected readonly periods = signal<AcademicPeriodRow[]>([]);
  protected readonly selectedPeriodUuid = signal<string | null>(null);
  protected readonly currentPeriodId = signal<string | null>(null);
  protected readonly units = signal<any[]>([]);
  protected readonly competencies = signal<any[]>([]);
  protected readonly addingCompetency = signal(false);
  protected readonly draftCompetencyName = signal('');
  protected readonly draftCapacities = signal<string[]>(['']);
  protected readonly competencyActionError = signal<string | null>(null);
  protected readonly sessionTemplates = signal<SessionTemplateDetail[]>([]);

  /** Periodos del año ACTIVE; el vigente primero, luego por ordinal. */
  protected readonly periodOptions = computed(() => {
    const currentId = this.currentPeriodId();
    return [...this.periods()].sort((a, b) => {
      if (currentId) {
        if (a.publicUuid === currentId) return -1;
        if (b.publicUuid === currentId) return 1;
      }
      return a.ordinal - b.ordinal;
    });
  });

  /** Asignaciones del periodo seleccionado (evita duplicados por bimestre). */
  protected readonly filteredAssignments = computed(() => {
    const periodId = this.selectedPeriodUuid();
    const rows = this.assignments();
    if (!periodId) return rows;
    return rows
      .filter((a) => a.academicPeriodPublicUuid === periodId)
      .sort((a, b) => {
        const byTeacher = String(a.teacherFullName ?? '').localeCompare(
          String(b.teacherFullName ?? ''),
          'es',
        );
        if (byTeacher !== 0) return byTeacher;
        return String(a.courseCode ?? '').localeCompare(String(b.courseCode ?? ''), 'es');
      });
  });

  protected readonly selectedSession = signal<LearningSessionDetail | null>(null);
  protected readonly selectedCompetencies = signal<Set<string>>(new Set());
  protected readonly selectedCapacities = signal<Set<string>>(new Set());
  /** Mirror del FormControl: los signals no reaccionan a valueChanges del form. */
  protected readonly selectedAssignmentUuid = signal<string | null>(null);

  protected readonly isEdit = computed(() => !!this.selectedSession());
  protected readonly isReadOnly = computed(() => {
    const status = this.selectedSession()?.status;
    return status === SessionStatus.COMPLETED || status === SessionStatus.CANCELLED;
  });

  protected readonly steps = [
    { id: 1 as const, label: 'Contexto', caption: 'Clase y fecha' },
    { id: 2 as const, label: 'Competencias', caption: 'Qué se trabaja' },
    { id: 3 as const, label: 'Desarrollo', caption: 'La clase en sí' },
  ];
  protected readonly durationPresets = [45, 90, 135];
  protected readonly step = signal<1 | 2 | 3>(1);
  protected readonly showStepErrors = signal(false);

  @ViewChild('stepAnchor') private stepAnchor?: ElementRef<HTMLElement>;

  protected readonly selectedAssignmentPreview = computed(() => {
    const id = this.selectedAssignmentUuid();
    if (!id) return null;
    return this.assignments().find((row) => row.publicUuid === id) ?? null;
  });

  protected headerSubtitle(): string {
    if (this.isReadOnly()) {
      return 'Esta sesión ya fue completada o cancelada y no puede editarse.';
    }
    switch (this.step()) {
      case 1:
        return 'Empieza por la clase, la fecha y el título.';
      case 2:
        return 'Marca las competencias que esta sesión va a trabajar.';
      default:
        return 'Escribe el desarrollo o genera un borrador con IA.';
    }
  }

  protected goToStep(target: 1 | 2 | 3): void {
    const current = this.step();
    if (target === current) return;
    if (target < current || this.isReadOnly() || this.isEdit()) {
      this.showStepErrors.set(false);
      this.step.set(target);
      this.scrollToStep();
      return;
    }
    for (let cursor = current; cursor < target; cursor = (cursor + 1) as 1 | 2 | 3) {
      if (!this.canLeaveStep(cursor)) {
        this.markStepTouched(cursor);
        this.showStepErrors.set(true);
        this.step.set(cursor);
        return;
      }
    }
    this.showStepErrors.set(false);
    this.step.set(target);
    this.scrollToStep();
  }

  protected nextStep(): void {
    const current = this.step();
    if (current >= 3) return;
    if (!this.canLeaveStep(current)) {
      this.markStepTouched(current);
      this.showStepErrors.set(true);
      return;
    }
    this.showStepErrors.set(false);
    this.step.set((current + 1) as 1 | 2 | 3);
    this.scrollToStep();
  }

  protected prevStep(): void {
    const current = this.step();
    if (current <= 1) return;
    this.showStepErrors.set(false);
    this.step.set((current - 1) as 1 | 2 | 3);
    this.scrollToStep();
  }

  protected continueHint(): string | null {
    if (this.step() !== 1) {
      return this.form.get('objective')?.invalid ? 'Falta el objetivo de aprendizaje.' : null;
    }
    const missing: string[] = [];
    if (this.form.get('assignmentUuid')?.invalid) missing.push('la clase');
    if (this.form.get('title')?.invalid) missing.push('el título');
    if (this.form.get('unitUuid')?.invalid) missing.push('la unidad');
    if (this.form.get('scheduledDate')?.invalid) missing.push('la fecha');
    if (this.form.get('durationMinutes')?.invalid) missing.push('la duración');
    return missing.length > 0 ? `Falta ${this.joinSpanish(missing)}.` : null;
  }

  protected setDuration(minutes: number): void {
    const control = this.form.get('durationMinutes');
    control?.setValue(minutes);
    control?.markAsDirty();
  }

  protected durationIs(minutes: number): boolean {
    return Number(this.form.get('durationMinutes')?.value) === minutes;
  }

  protected addPhaseActivity(phase: 'INICIO' | 'DESARROLLO' | 'CIERRE'): void {
    const minutes = phase === 'DESARROLLO' ? 25 : 10;
    this.activitiesArray.push(
      this.fb.control(`[${phase}] (${minutes} min)\nQué hace el docente y qué hacen los estudiantes.`),
    );
  }

  protected activityPhaseLabel(value: unknown): string | null {
    const match = /^\[([^\]]+)\]/.exec(String(value ?? '').trim());
    const label = match?.[1]?.trim();
    return label ? label : null;
  }

  private canLeaveStep(step: 1 | 2 | 3): boolean {
    if (this.isReadOnly() || step === 2) return true;
    if (step === 1) {
      return ['assignmentUuid', 'unitUuid', 'scheduledDate', 'title', 'durationMinutes'].every(
        (name) => this.form.get(name)?.valid,
      );
    }
    return !!this.form.get('objective')?.valid;
  }

  private markStepTouched(step: 1 | 2 | 3): void {
    const names =
      step === 1
        ? ['assignmentUuid', 'unitUuid', 'scheduledDate', 'title', 'durationMinutes']
        : step === 3
          ? ['objective']
          : [];
    for (const name of names) {
      this.form.get(name)?.markAsTouched();
    }
  }

  private scrollToStep(): void {
    queueMicrotask(() => {
      this.stepAnchor?.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  private joinSpanish(parts: string[]): string {
    if (parts.length <= 1) return parts[0] ?? '';
    return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  }

  // ============================================================================
  // Sprint cierre-B / F9 — AI panel integration
  // ============================================================================

  /** Builds the SSE request body from the current form state. */
  protected readonly aiSessionRequestBody = computed(() => {
    const assignmentUuid = this.selectedAssignmentUuid() ?? '';
    const assignment = this.assignments().find((a: { publicUuid: string }) => a.publicUuid === assignmentUuid);
    const title = this.form.get('title')?.value ?? '';
    const durationMinutes = Number(this.form.get('durationMinutes')?.value ?? 45);
    return {
      topic: title,
      courseId: assignment?.coursePublicUuid ?? '',
      unitId: this.form.get('unitUuid')?.value ?? '',
      durationMinutes,
      competencyIds: Array.from(this.selectedCompetencies()),
      capacityIds: Array.from(this.selectedCapacities()),
      templateUuid: this.form.get('templateUuid')?.value || null,
      gradeName: this.primaryGrade() || null,
    };
  });

  /** One-line summary shown in the AI panel after a successful generation. */
  protected readonly aiDraftSummary = signal<string>('');
  protected readonly wantApplicationSheet = signal(false);
  protected readonly includeDiagnostic = signal(false);
  protected readonly extraGrade = signal('');
  protected readonly sheetDrafts = signal<ApplicationSheetView[]>([]);
  protected readonly sheetsLoading = signal(false);
  protected readonly sheetError = signal<string | null>(null);

  protected readonly primaryGrade = computed(() => {
    const assignmentUuid = this.selectedAssignmentUuid();
    const assignment = this.assignments().find(
      (row: { publicUuid: string; gradeName?: string | null }) => row.publicUuid === assignmentUuid,
    );
    return assignment?.gradeName?.trim() ?? '';
  });

  /** Pure JSON.parse; the BE hands us a full SessionGeneratorResult envelope. */
  protected readonly parseSessionDraft = (json: string): { session: { title: string; summary: string; activities: { phase: string; name: string; durationMinutes: number; description: string }[]; resources: { type: string; title: string; url?: string; description: string }[]; evaluationCriteria: { name: string; weight: number; description: string }[] }; persistedSessionUuid?: string } => JSON.parse(json);

  /** Applies the AI draft to the form fields. */
  protected applySessionDraft(payload: { session: { title: string; summary: string; activities: { phase: string; name: string; durationMinutes: number; description: string }[]; resources: { type: string; title: string; url?: string; description: string }[]; evaluationCriteria: { name: string; weight: number; description: string }[] }; persistedSessionUuid?: string }): void {
    const session = payload?.session;
    if (!session) {
      this.errorMessage.set('La IA no devolvió un borrador válido.');
      return;
    }
    this.form.patchValue({
      title: session.title,
      objective: session.summary,
    });
    // #region agent log
    fetch('http://127.0.0.1:7639/ingest/f4773d1b-17bd-44c3-8d39-badf894fd980',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'325667'},body:JSON.stringify({sessionId:'325667',runId:'post-fix',hypothesisId:'A',location:'sessions-form.component.ts:applySessionDraft',message:'draft applied',data:{grade:this.primaryGrade(),objectiveHasInicial:/inicial/i.test(session.summary ?? ''),objectiveHasPrimaria:/primaria/i.test(session.summary ?? '')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // El formulario guarda actividades y materiales como texto (igual que la
    // plantilla de sesión). La IA devuelve objetos; se aplanan a una línea.
    this.activitiesArray.clear();
    for (const a of session.activities ?? []) {
      this.activitiesArray.push(this.fb.control(this.activityLine(a)));
    }
    this.materialsArray.clear();
    for (const r of session.resources ?? []) {
      this.materialsArray.push(this.fb.control(this.materialLine(r)));
    }
    // Append evaluation criteria to observations for now (the form has no dedicated criteria UI yet).
    const criteria = (session.evaluationCriteria ?? [])
      .map((c) => `- ${c.name} (${Math.round(c.weight * 100)}%): ${c.description}`)
      .join('\n');
    const existingObs = this.form.get('observations')?.value ?? '';
    const merged = existingObs ? `${existingObs}\n\nCriterios de evaluación:\n${criteria}` : `Criterios de evaluación:\n${criteria}`;
    this.form.patchValue({ observations: merged });

    this.aiDraftSummary.set(
      `Aplicado: ${session.activities?.length ?? 0} actividades, ${session.resources?.length ?? 0} materiales, ${session.evaluationCriteria?.length ?? 0} criterios. Revisá antes de guardar.`,
    );
    if (this.wantApplicationSheet()) {
      void this.generateSheetDrafts(session);
    }
  }

  protected replaceSheet(next: ApplicationSheetView): void {
    this.sheetDrafts.update((rows) =>
      rows.map((row) => (row.kind === next.kind && row.grade === next.grade ? next : row)),
    );
  }

  private async generateSheetDrafts(session: {
    title: string;
    summary: string;
    activities: { phase: string; name: string; durationMinutes: number; description: string }[];
    evaluationCriteria: { name: string; weight: number; description: string }[];
  }): Promise<void> {
    const grades = [this.primaryGrade(), this.extraGrade().trim()].filter(
      (grade, index, all) => grade.length > 0 && all.indexOf(grade) === index,
    );
    if (grades.length === 0) {
      this.sheetError.set('La asignación no tiene grado. Escribe el grado de la ficha.');
      this.sheetDrafts.set([]);
      return;
    }
    const assignmentUuid = this.selectedAssignmentUuid() ?? '';
    const assignment = this.assignments().find(
      (row: { publicUuid: string; courseName?: string; courseCode?: string }) =>
        row.publicUuid === assignmentUuid,
    );
    const courseName = assignment?.courseName?.trim() || assignment?.courseCode?.trim() || 'Curso';
    const kinds: ApplicationSheetKind[] = this.includeDiagnostic()
      ? ['LEARNING', 'DIAGNOSTIC']
      : ['LEARNING'];
    this.sheetsLoading.set(true);
    this.sheetError.set(null);
    const drafts: ApplicationSheetView[] = [];
    try {
      for (const grade of grades) {
        for (const kind of kinds) {
          const request: GenerateApplicationSheetRequest = {
            kind,
            grade,
            courseName,
            topic: session.title,
            sessionTitle: session.title,
            sessionSummary: session.summary,
            activities: (session.activities ?? []).map((activity) => ({
              phase: activity.phase,
              name: activity.name,
              description: activity.description,
            })),
            evaluationCriteria: (session.evaluationCriteria ?? []).map((criterion) => ({
              name: criterion.name,
              description: criterion.description,
            })),
          };
          if (request.activities.length === 0) {
            request.activities.push({ name: session.title, description: session.summary });
          }
          const sheet = await firstValueFrom(this.api.generateApplicationSheet(request));
          drafts.push(sheet);
        }
      }
      this.sheetDrafts.set(drafts);
      // #region agent log
      fetch('http://127.0.0.1:7639/ingest/f4773d1b-17bd-44c3-8d39-badf894fd980',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'325667'},body:JSON.stringify({sessionId:'325667',runId:'post-fix',hypothesisId:'C',location:'sessions-form.component.ts:generateSheetDrafts',message:'sheet drafts ready',data:{count:drafts.length,grades:drafts.map((row)=>row.grade),kinds:drafts.map((row)=>row.kind)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (err) {
      this.sheetDrafts.set([]);
      this.sheetError.set(err instanceof Error ? err.message : 'No se pudo generar la ficha.');
    } finally {
      this.sheetsLoading.set(false);
    }
  }

  protected onAiError(message: string): void {
    this.errorMessage.set(`IA: ${message}`);
  }

  /** Misma forma que la plantilla: `[FASE] nombre (N min) — descripción`. */
  private activityLine(a: {
    phase?: string;
    name?: string;
    durationMinutes?: number;
    description?: string;
  }): string {
    const phase = a.phase?.trim() || 'INICIO';
    const name = a.name?.trim() || '';
    const dur = a.durationMinutes && a.durationMinutes > 0 ? `${a.durationMinutes} min` : '';
    const desc = a.description?.trim() || '';
    const head = `[${phase}]${name ? ` ${name}` : ''}${dur ? ` (${dur})` : ''}`.trim();
    return desc ? `${head}\n${desc}` : head;
  }

  private materialLine(r: {
    type?: string;
    title?: string;
    url?: string;
    description?: string;
  }): string {
    const title = r.title?.trim() || 'Recurso';
    const url = r.url?.trim() || '';
    const kind = r.type?.trim() || '';
    const desc = r.description?.trim() || '';
    return [title, url, kind ? `(${kind})` : '', desc].filter((part) => part.length > 0).join(' ');
  }

  protected readonly selectedCourseUuid = computed(() => {
    const assignmentUuid = this.selectedAssignmentUuid();
    if (!assignmentUuid) return null;
    const assignment = this.assignments().find((a: any) => a.publicUuid === assignmentUuid);
    return assignment?.coursePublicUuid || null;
  });

  get activitiesArray(): FormArray {
    return this.form.get('activities') as FormArray;
  }

  get materialsArray(): FormArray {
    return this.form.get('materials') as FormArray;
  }

  async ngOnInit(): Promise<void> {
    await this.loadPeriods();
    await this.loadAssignments();
    await this.loadSessionTemplates();

    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      await this.loadSession(sessionId);
    }

    // Escuchar cambios en la asignación para cargar unidades y competencias
    this.form.get('assignmentUuid')?.valueChanges.subscribe((assignmentUuid) => {
      this.selectedAssignmentUuid.set(assignmentUuid || null);
      if (assignmentUuid) {
        const assignment = this.assignments().find((a) => a.publicUuid === assignmentUuid);
        const courseUuid = assignment?.coursePublicUuid as string | undefined;
        if (courseUuid) {
          void this.loadUnits(courseUuid);
          void this.loadCompetencies(courseUuid);
          this.form.get('unitUuid')?.setValue('');
          this.selectedCompetencies.set(new Set());
          this.selectedCapacities.set(new Set());
        } else {
          this.units.set([]);
          this.competencies.set([]);
          this.errorMessage.set(
            'La asignación seleccionada no tiene curso asociado; no se pueden cargar competencias.',
          );
        }
      } else {
        this.units.set([]);
        this.competencies.set([]);
        this.form.get('unitUuid')?.setValue('');
      }
    });
  }

  protected periodOptionLabel(period: AcademicPeriodRow): string {
    const label = formatPeriodLabel(period);
    return period.publicUuid === this.currentPeriodId() ? `${label} (vigente)` : label;
  }

  /** Docente — Curso (Grado · Sección), alineado con selects de asistencia/LMS. */
  protected assignmentOptionLabel(a: {
    teacherFullName?: string;
    courseCode?: string;
    courseName?: string;
    gradeName?: string | null;
    sectionName?: string;
  }): string {
    const teacher = a.teacherFullName?.trim() || 'Docente';
    const course = a.courseCode?.trim() || a.courseName?.trim() || 'Curso';
    const grade = a.gradeName?.trim();
    const section = a.sectionName?.trim() || '';
    const sectionLabel = grade ? `${grade} · ${section}` : section || '—';
    return `${teacher} — ${course} (${sectionLabel})`;
  }

  protected onPeriodChange(nextPeriodUuid: string): void {
    if (this.isEdit() || this.isReadOnly()) return;
    this.selectedPeriodUuid.set(nextPeriodUuid || null);
    const current = this.form.get('assignmentUuid')?.value as string;
    const stillVisible = this.filteredAssignments().some((a) => a.publicUuid === current);
    if (!stillVisible) {
      this.form.patchValue({ assignmentUuid: '', unitUuid: '' });
      this.selectedAssignmentUuid.set(null);
      this.units.set([]);
      this.competencies.set([]);
      this.selectedCompetencies.set(new Set());
      this.selectedCapacities.set(new Set());
    }
  }

  private async loadPeriods(): Promise<void> {
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const activeYear = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      if (!activeYear) {
        this.periods.set([]);
        this.currentPeriodId.set(null);
        this.selectedPeriodUuid.set(null);
        return;
      }
      const periods = await firstValueFrom(
        this.academicApi.listPeriods({ academicYearPublicUuid: activeYear.publicUuid }),
      );
      this.periods.set(periods);
      const current = resolveCurrentAcademicPeriod(periods);
      const currentId = current?.publicUuid ?? null;
      this.currentPeriodId.set(currentId);
      // Siempre arrancar en el vigente; si no hay (vacaciones / sin fechas), el de menor ordinal.
      this.selectedPeriodUuid.set(currentId ?? periods[0]?.publicUuid ?? null);
    } catch {
      this.periods.set([]);
      this.currentPeriodId.set(null);
      this.selectedPeriodUuid.set(null);
    }
  }

  private async loadAssignments(): Promise<void> {
    try {
      const data = await firstValueFrom(this.academicApi.listAssignments({ activeOnly: true }));
      this.assignments.set(data);
    } catch (err) {
      this.errorMessage.set('Error al cargar asignaciones');
    }
  }

  private async loadSessionTemplates(): Promise<void> {
    try {
      const data = await firstValueFrom(this.templatesApi.listMine());
      this.sessionTemplates.set(data);
      const def = data.find((t) => t.isDefault);
      if (def && !this.isEdit() && !this.form.get('templateUuid')?.value) {
        this.form.patchValue({ templateUuid: def.publicUuid });
        this.onTemplateSelected();
      }
    } catch {
      // Non-blocking: form still works without templates.
      this.sessionTemplates.set([]);
    }
  }

  protected onTemplateSelected(): void {
    if (this.isEdit() || this.isReadOnly()) return;
    const uuid = this.form.get('templateUuid')?.value as string;
    if (!uuid) return;
    const tpl = this.sessionTemplates().find((t) => t.publicUuid === uuid);
    if (!tpl?.schema) return;
    const activitiesEmpty = this.activitiesArray.length === 0
      || this.activitiesArray.controls.every((c) => !String(c.value ?? '').trim());
    if (!activitiesEmpty) return;

    const schema = tpl.schema as Record<string, unknown>;
    const phases = Array.isArray(schema['phases']) ? (schema['phases'] as Record<string, unknown>[]) : [];
    this.activitiesArray.clear();
    for (const p of phases) {
      const name = p['name'] ?? 'Fase';
      const dur = p['duration_min'];
      const desc = p['description'] ?? '';
      const line = `[${name}]${dur != null ? ` ${dur} min` : ''} — ${desc}`.trim();
      this.activitiesArray.push(this.fb.control(line));
    }
    const mats = Array.isArray(schema['materials_suggested'])
      ? (schema['materials_suggested'] as unknown[]).map(String)
      : [];
    if (this.materialsArray.length === 0 && mats.length > 0) {
      for (const m of mats) {
        this.materialsArray.push(this.fb.control(m));
      }
    }
  }

  private async loadUnits(courseUuid: string): Promise<void> {
    try {
      const data = await firstValueFrom(this.academicApi.listUnits(courseUuid));
      this.units.set(data.filter((u: any) => u.isActive));
    } catch (err) {
      this.errorMessage.set('Error al cargar unidades');
    }
  }

  protected canDeactivateCompetency(comp: {
    origin?: string;
    createdBy?: string | null;
    isActive?: boolean;
  }): boolean {
    if (this.isReadOnly() || comp.isActive === false) return false;
    const me = this.auth.user()?.publicUuid;
    return comp.origin === 'TEACHER' && !!me && comp.createdBy === me;
  }

  protected openAddCompetency(): void {
    this.competencyActionError.set(null);
    this.draftCompetencyName.set('');
    this.draftCapacities.set(['']);
    this.addingCompetency.set(true);
  }

  protected cancelAddCompetency(): void {
    this.addingCompetency.set(false);
    this.competencyActionError.set(null);
  }

  protected addDraftCapacity(): void {
    this.draftCapacities.update((rows) => [...rows, '']);
  }

  protected setDraftCapacity(index: number, value: string): void {
    this.draftCapacities.update((rows) => rows.map((row, i) => (i === index ? value : row)));
  }

  protected async saveDraftCompetency(): Promise<void> {
    const courseUuid = this.selectedCourseUuid();
    const name = this.draftCompetencyName().trim();
    const capacities = this.draftCapacities().map((c) => c.trim()).filter((c) => c.length > 0);
    if (!courseUuid) return;
    if (!name || capacities.length === 0) {
      this.competencyActionError.set('Escribe el nombre y al menos una capacidad.');
      return;
    }
    this.saving.set(true);
    this.competencyActionError.set(null);
    try {
      const created = await firstValueFrom(
        this.academicApi.createCompetency(courseUuid, {
          name,
          capacities: capacities.map((capacityName) => ({ name: capacityName })),
        }),
      );
      await this.loadCompetencies(courseUuid);
      const set = new Set(this.selectedCompetencies());
      set.add(created.publicUuid);
      this.selectedCompetencies.set(set);
      this.addingCompetency.set(false);
    } catch (err) {
      this.competencyActionError.set(this.readApiError(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected async deactivateCompetency(comp: { publicUuid: string }): Promise<void> {
    const courseUuid = this.selectedCourseUuid();
    if (!courseUuid) return;
    this.saving.set(true);
    this.competencyActionError.set(null);
    try {
      await firstValueFrom(this.academicApi.deactivateCompetency(comp.publicUuid));
      const selected = new Set(this.selectedCompetencies());
      selected.delete(comp.publicUuid);
      this.selectedCompetencies.set(selected);
      await this.loadCompetencies(courseUuid);
    } catch (err) {
      this.competencyActionError.set(this.readApiError(err));
    } finally {
      this.saving.set(false);
    }
  }

  private readApiError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string; code?: string } }).error;
      return body?.message || body?.code || 'No se pudo guardar la competencia.';
    }
    return 'No se pudo guardar la competencia.';
  }

  private async loadCompetencies(courseUuid: string): Promise<void> {
    try {
      const rows = await firstValueFrom(this.academicApi.listCompetencies(courseUuid));
      const active = rows.filter((c: { isActive: boolean }) => c.isActive);
      // listCompetencies no embebe capacities; hidratar para el picker de la sesión.
      const hydrated = await Promise.all(
        active.map(async (row) => {
          try {
            const detail = await firstValueFrom(this.academicApi.getCompetency(row.publicUuid));
            return {
              ...row,
              origin: detail.origin ?? row.origin,
              createdBy: detail.createdBy ?? row.createdBy,
              capacities: (detail.capacities ?? []).filter((cap) => cap.isActive),
            };
          } catch {
            return { ...row, capacities: [] };
          }
        }),
      );
      this.competencies.set(hydrated);
    } catch (err) {
      this.errorMessage.set('Error al cargar competencias');
    }
  }

  private async loadSession(publicUuid: string): Promise<void> {
    this.loading.set(true);
    try {
      const session = await firstValueFrom(this.api.getSession(publicUuid));
      this.selectedSession.set(session);

      this.form.patchValue({
        assignmentUuid: session.assignment.publicUuid,
        unitUuid: session.unit.publicUuid,
        scheduledDate: session.scheduledDate.toISOString().split('T')[0],
        title: session.title,
        durationMinutes: session.durationMinutes,
        objective: session.content.objective,
        observations: session.content.observations,
      });
      this.selectedAssignmentUuid.set(session.assignment.publicUuid);

      // Alinear el selector de periodo con la asignación de la sesión
      // (en edición el periodo queda bloqueado junto con la asignación).
      const periodUuid = session.assignment.period?.publicUuid ?? null;
      if (periodUuid) {
        this.selectedPeriodUuid.set(periodUuid);
      }

      // Cargar actividades
      this.activitiesArray.clear();
      session.content.activities.forEach((act) => {
        this.activitiesArray.push(this.fb.control(act));
      });

      // Cargar materiales
      this.materialsArray.clear();
      session.content.materials.forEach((mat) => {
        this.materialsArray.push(this.fb.control(mat));
      });

      // Seleccionar competencias y capacidades
      const compSet = new Set<string>();
      const capSet = new Set<string>();
      session.competencies.forEach((c) => compSet.add(c.publicUuid));
      session.capacities.forEach((c) => capSet.add(c.publicUuid));
      this.selectedCompetencies.set(compSet);
      this.selectedCapacities.set(capSet);

      // Forzar la carga de unidades y competencias de este curso
      await this.loadUnits(session.assignment.course.publicUuid);
      await this.loadCompetencies(session.assignment.course.publicUuid);
    } catch (err) {
      this.errorMessage.set('Error al cargar la sesión');
    } finally {
      this.loading.set(false);
    }
  }

  protected addActivity(): void {
    this.activitiesArray.push(this.fb.control(''));
  }

  protected removeActivity(index: number): void {
    this.activitiesArray.removeAt(index);
  }

  protected addMaterial(): void {
    this.materialsArray.push(this.fb.control(''));
  }

  protected removeMaterial(index: number): void {
    this.materialsArray.removeAt(index);
  }

  protected isCompetencySelected(publicUuid: string): boolean {
    return this.selectedCompetencies().has(publicUuid);
  }

  protected isCapacitySelected(publicUuid: string): boolean {
    return this.selectedCapacities().has(publicUuid);
  }

  protected toggleCompetency(publicUuid: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const set = new Set(this.selectedCompetencies());
    if (checked) {
      set.add(publicUuid);
    } else {
      set.delete(publicUuid);
      // Deseleccionar capacidades de esta competencia
      const comp = this.competencies().find((c) => c.publicUuid === publicUuid);
      if (comp) {
        const capSet = new Set(this.selectedCapacities());
        comp.capacities.forEach((cap: any) => capSet.delete(cap.publicUuid));
        this.selectedCapacities.set(capSet);
      }
    }
    this.selectedCompetencies.set(set);
  }

  protected toggleCapacity(publicUuid: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const set = new Set(this.selectedCapacities());
    if (checked) {
      set.add(publicUuid);
    } else {
      set.delete(publicUuid);
    }
    this.selectedCapacities.set(set);
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (!this.canLeaveStep(1)) {
        this.step.set(1);
      } else {
        this.step.set(3);
      }
      this.showStepErrors.set(true);
      this.scrollToStep();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      assignmentUuid: raw.assignmentUuid,
      unitUuid: raw.unitUuid,
      title: raw.title.trim(),
      objective: raw.objective.trim(),
      scheduledDate: raw.scheduledDate,
      durationMinutes: raw.durationMinutes,
      competencyUuids: Array.from(this.selectedCompetencies()),
      capacityUuids: Array.from(this.selectedCapacities()),
      templateUuid: raw.templateUuid || null,
      content: {
        objective: raw.objective.trim(),
        activities: raw.activities.filter((a: string) => a.trim() !== ''),
        materials: raw.materials.filter((m: string) => m.trim() !== ''),
        observations: raw.observations?.trim() || '',
      },
      applicationSheets: this.wantApplicationSheet()
        ? this.sheetDrafts().map((sheet) => ({
            kind: sheet.kind,
            grade: sheet.grade,
            title: sheet.title,
            content: sheet.content,
          }))
        : undefined,
    };

    if (this.wantApplicationSheet() && !this.isEdit() && this.sheetDrafts().length === 0) {
      this.errorMessage.set('Genera el borrador de la sesión para crear las fichas, o desmarca la casilla.');
      this.saving.set(false);
      return;
    }

    try {
      if (this.isEdit()) {
        const uuid = this.route.snapshot.paramMap.get('id')!;
        await firstValueFrom(this.api.updateSession(uuid, payload as UpdateLearningSessionRequest));
      } else {
        await firstValueFrom(this.api.createSession(payload as CreateLearningSessionRequest));
      }
      this.formProtection.markSaved();
          void this.router.navigate([ROUTES.SESSIONS.LIST]);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al guardar la sesión');
      this.saving.set(false);
    }
  }
}

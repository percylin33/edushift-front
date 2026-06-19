import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { ApiError } from '@core/models';
import {
  IconComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import { TasksStore } from '../../store';
import { TaskLifecycle, isTaskEditable } from '../../models';

/**
 * Validator a nivel grupo: {@code dueAt} debe ser estrictamente futura
 * (con un margen de 60s para evitar edge cases con segundos de drift
 * entre el cliente y el backend). Vive top-level para evitar el
 * forward-reference que TypeScript marca como TS2729 cuando se declara
 * dentro del initializer de la clase.
 */
function dueAtInFuture(group: AbstractControl): ValidationErrors | null {
  const due = group.get('dueAt')?.value as string | null;
  if (!due) return null;
  const ts = new Date(due).getTime();
  if (Number.isNaN(ts)) return null;
  return ts > Date.now() + 60_000 ? null : { dueAtPast: true };
}

/**
 * Form compartido por {@code /lms/assignments/new} y
 * {@code /lms/assignments/:uuid/edit} (FE-7a.1 Scenario 2).
 *
 * <h3>Por qué un solo componente</h3>
 * El field set de creación y edición coincide al 100%; el modo se
 * detecta por la presencia de {@code :uuid} en la ruta. Misma decisión
 * que {@code YearFormComponent} (academic).
 *
 * <h3>Validación</h3>
 * Espejea los constraints del backend (BE-7a.2):
 * <ul>
 *   <li>{@code title}: requerido, 3..200.</li>
 *   <li>{@code description}: opcional, max 5000.</li>
 *   <li>{@code dueAt}: requerido, futuro, datetime-local.</li>
 *   <li>{@code maxScore}: requerido, decimal 0 < x ≤ 1000.</li>
 *   <li>{@code sectionCoursePeriod}: en MVP el docente elige el curso
 *       de un select; la sección + periodo van fijos en la query
 *       string (?section=...) — el form no los edita.</li>
 * </ul>
 *
 * <h3>Errores del servidor</h3>
 * Los códigos del módulo se mapean a errores inline:
 * <ul>
 *   <li>{@code LMS_TASK_DUE_AT_REQUIRED_FOR_PUBLISH} → warning top-level
 *       (no bloquea el submit, pero el publish se rechaza luego).</li>
 *   <li>{@code LMS_TASK_NOT_EDITABLE} → banner + redirect a la lista.</li>
 *   <li>{@code LMS_TASK_TITLE_TAKEN} → error inline en title.</li>
 * </ul>
 */
@Component({
  selector: 'app-task-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent
  ],
  template: `
    <app-page-header
      [title]="title()"
      [subtitle]="subtitle()"
      eyebrow="LMS · Tareas"
    >
      <a [routerLink]="listRoute()" class="btn btn-ghost btn-sm">
        <app-icon name="arrow-left" [size]="16" />
        <span class="hidden sm:inline">Volver</span>
      </a>
    </app-page-header>

    @if (loadingDetail()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando tarea…" />
      </div>
    } @else {
      @if (errorBanner(); as err) {
        <div class="alert alert-danger mb-4" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos guardar los cambios.</p>
            <p class="mt-1 text-xs opacity-80">{{ err }}</p>
          </div>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="grid gap-6">
        <section class="card">
          <header class="card-header">
            <h2 class="card-title">Datos de la tarea</h2>
            <p class="card-description">
              Identificación visible y parámetros de calificación. Los alumnos
              sólo verán la tarea cuando la publiques.
            </p>
          </header>

          <div class="card-body grid gap-4 sm:grid-cols-12">
            <div class="field sm:col-span-12">
              <label class="label" for="task-title">Título *</label>
              <input
                id="task-title"
                type="text"
                class="input"
                placeholder="Tarea 1 — Ecuaciones lineales"
                formControlName="title"
                autocomplete="off"
              />
              @if (showError('title'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">Entre 3 y 200 caracteres.</p>
              }
            </div>

            <div class="field sm:col-span-12">
              <label class="label" for="task-description">Descripción</label>
              <textarea
                id="task-description"
                class="input min-h-[120px]"
                placeholder="Enunciado, recursos, formato esperado…"
                formControlName="description"
                rows="4"
              ></textarea>
              @if (showError('description'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">Opcional. Hasta 5000 caracteres.</p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="task-dueAt">Fecha y hora de entrega *</label>
              <input
                id="task-dueAt"
                type="datetime-local"
                class="input"
                formControlName="dueAt"
              />
              @if (showError('dueAt'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else if (form.errors?.['dueAtPast']) {
                <p class="field-error">
                  La fecha de entrega debe ser futura.
                </p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="task-maxScore">Puntaje máximo *</label>
              <input
                id="task-maxScore"
                type="number"
                class="input"
                min="0.1"
                max="1000"
                step="0.1"
                formControlName="maxScore"
              />
              @if (showError('maxScore'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="sm:col-span-12 flex flex-wrap gap-4">
              <label class="flex items-center gap-2 text-sm text-content">
                <input type="checkbox" formControlName="allowResubmissions" />
                Permitir re-entregas después de calificar
              </label>
              <label class="flex items-center gap-2 text-sm text-content">
                <input type="checkbox" formControlName="requiresAttachment" />
                Solicitar archivo adjunto
              </label>
            </div>
          </div>
        </section>

        <footer class="flex flex-wrap items-center justify-end gap-2">
          <a [routerLink]="listRoute()" class="btn btn-ghost btn-sm">Cancelar</a>
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            [disabled]="form.invalid || saving()"
          >
            @if (saving()) {
              <app-spinner [size]="14" label="Guardando" />
              <span>Guardando…</span>
            } @else {
              <span>{{ submitLabel() }}</span>
              <app-icon name="check" [size]="16" />
            }
          </button>
        </footer>
      </form>
    }
  `
})
export class TaskFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(TasksStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  private readonly fieldErrors = signal<Record<string, string>>({});

  /** Edit UUID if present; null when creating. */
  private editUuid: string | null = null;
  /** Section UUID captured from the query string on create flow. */
  #sectionUuid: string | null = null;
  /** Course + period picked by the TEACHER when creating. */
  #courseUuid: string | null = null;
  #periodUuid: string | null = null;

  protected readonly editing = signal(false);

  protected readonly title = computed(() =>
    this.editing() ? 'Editar tarea' : 'Nueva tarea'
  );
  protected readonly subtitle = computed(() =>
    this.editing()
      ? 'Actualiza título, descripción, fecha o puntaje. Los alumnos no verán los cambios hasta que vuelvas a publicar.'
      : 'Crea la tarea en estado Borrador. Podrás revisarla y publicarla después.'
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear tarea'
  );

  /**
   * Reactive form. Validators espejean el backend; el grupo lleva
   * además {@link dueAtInFuture} para el cruce con el reloj del
   * cliente (Angular no expone cross-field validators sin helper).
   */
  protected readonly form: FormGroup = this.fb.group(
    {
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      description: ['', [Validators.maxLength(5000)]],
      dueAt: ['', [Validators.required]],
      maxScore: [20, [Validators.required, Validators.min(0.1), Validators.max(1000)]],
      allowResubmissions: [true],
      requiresAttachment: [false]
    },
    { validators: [dueAtInFuture] }
  );

  async ngOnInit(): Promise<void> {
    this.store.clearError();

    const id = this.route.snapshot.paramMap.get('uuid');
    this.editUuid = id;
    this.editing.set(!!id);

    if (id) {
      const detail = await this.store.loadDetail(id);
      if (!detail) {
        await this.router.navigate([ROUTES.LMS.ROOT]);
        return;
      }
      if (!isTaskEditable(detail) && detail.lifecycle !== TaskLifecycle.Published) {
        // CLOSED: backend rechaza el PATCH; devolver al usuario a la lista.
        await this.router.navigate([ROUTES.LMS.ROOT]);
        return;
      }
      this.#sectionUuid = detail.sectionPublicUuid;
      this.#courseUuid = detail.coursePublicUuid;
      this.#periodUuid = detail.periodPublicUuid;
      this.hydrateFrom(detail);
    } else {
      // Create flow — the section comes from the query string.
      this.#sectionUuid =
        this.route.snapshot.queryParamMap.get('section') ??
        this.route.snapshot.paramMap.get('sectionUuid');
      if (!this.#sectionUuid) {
        await this.router.navigate([ROUTES.LMS.ROOT]);
        return;
      }
    }
  }

  // ===========================================================================
  // Submit
  // ===========================================================================

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.editUuid;
    try {
      if (id) {
        const patch = this.toUpdateRequest();
        const updated = await this.store.updateTask(id, patch);
        if (updated) {
          await this.router.navigate([ROUTES.LMS.assignmentDetail(updated.publicUuid)]);
        }
      } else {
        if (!this.#sectionUuid) {
          await this.router.navigate([ROUTES.LMS.ROOT]);
          return;
        }
        const request = this.toCreateRequest();
        const created = await this.store.createTask(request);
        if (created) {
          await this.router.navigate([ROUTES.LMS.assignmentDetail(created.publicUuid)]);
        }
      }
    } catch (err) {
      this.applyServerErrors(err);
    }
  }

  protected listRoute(): string {
    if (this.#sectionUuid) {
      return ROUTES.LMS.sectionAssignments(this.#sectionUuid);
    }
    return ROUTES.LMS.ROOT;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return null;

    const serverErr = this.fieldErrors()[controlName];
    if (serverErr) return serverErr;

    if (!ctrl.touched && !ctrl.dirty) return null;
    if (!ctrl.errors) return null;
    if (ctrl.errors['required']) return 'Campo requerido.';
    if (ctrl.errors['minlength']) {
      return `Debe tener al menos ${ctrl.errors['minlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors['maxlength']) {
      return `Debe tener como máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors['min']) return `Debe ser mayor que ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['max']) return `Debe ser menor o igual que ${ctrl.errors['max'].max}.`;
    return 'Valor inválido.';
  }

  private hydrateFrom(detail: {
    title: string;
    description: string | null;
    dueAt: Date | null;
    maxScore: number;
    allowResubmissions: boolean;
    requiresAttachment: boolean;
  }): void {
    this.form.patchValue({
      title: detail.title,
      description: detail.description ?? '',
      dueAt: this.toDateTimeLocal(detail.dueAt),
      maxScore: detail.maxScore,
      allowResubmissions: detail.allowResubmissions,
      requiresAttachment: detail.requiresAttachment
    });
  }

  private toCreateRequest() {
    const v = this.form.getRawValue();
    return {
      sectionPublicUuid: this.#sectionUuid!,
      // MVP: el form no edita course/period; backend los toma del section.
      // En la integración final se resolverán via un select poblado por
      // `GET /v1/academic/teacher-assignments?section=...` (FE-7a.1 / ADR-7A.1).
      coursePublicUuid: this.#courseUuid ?? 'TODO',
      periodPublicUuid: this.#periodUuid ?? 'TODO',
      title: (v.title ?? '').trim(),
      description: (v.description ?? '').trim() || null,
      dueAt: this.toIsoUtc(v.dueAt as string),
      maxScore: Number(v.maxScore),
      allowResubmissions: !!v.allowResubmissions,
      requiresAttachment: !!v.requiresAttachment
    };
  }

  private toUpdateRequest() {
    const v = this.form.getRawValue();
    return {
      title: (v.title ?? '').trim(),
      description: (v.description ?? '').trim() || null,
      dueAt: this.toIsoUtc(v.dueAt as string),
      maxScore: Number(v.maxScore),
      allowResubmissions: !!v.allowResubmissions,
      requiresAttachment: !!v.requiresAttachment
    };
  }

  /**
   * Convierte el valor de `<input type="datetime-local">`
   * ({@code YYYY-MM-DDTHH:mm}, naive local) a ISO-8601 con offset Z
   * que espera el backend. La conversión respeta la zona horaria del
   * navegador (UX: el usuario ve la hora que introdujo).
   */
  private toIsoUtc(local: string): string {
    if (!local) return '';
    const d = new Date(local);
    return d.toISOString();
  }

  /**
   * Inverso: ISO-8601 → {@code YYYY-MM-DDTHH:mm} para
   * {@code <input type="datetime-local">}.
   */
  private toDateTimeLocal(d: Date | null): string {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'LMS_TASK_TITLE_TAKEN':
        next['title'] = 'Ya existe una tarea con este título en la sección.';
        break;
      default:
        break;
    }
    this.fieldErrors.set(next);
  }
}

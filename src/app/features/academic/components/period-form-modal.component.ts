import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicStore } from '../store';
import {
  AcademicPeriodDetail,
  AcademicPeriodRow,
  AcademicYearRow,
  AcademicYearStatus,
  PERIOD_TYPE_LABELS,
  PeriodType,
  defaultPeriodName,
  findOverlappingPeriods,
  isDateRangeValid,
  isWithinYear,
  parseLocalDate,
  toLocalDateString,
} from '../models';
import { PeriodTimelineComponent, TimelinePreviewItem } from './period-timeline.component';

/**
 * Modal de creación / edición de un {@link AcademicPeriodDetail}.
 *
 * <h3>Validación client-side (espejo del orden BE)</h3>
 * <ol>
 *   <li>{@code year.status !== CLOSED} — espejo de
 *       {@code ACADEMIC_YEAR_LOCKED}.</li>
 *   <li>{@code start < end} — espejo de
 *       {@code PERIOD_DATE_INVERTED}.</li>
 *   <li>{@code start >= year.startDate && end <= year.endDate} —
 *       espejo de {@code PERIOD_OUT_OF_YEAR_RANGE}.</li>
 *   <li>Sin overlap con otros periodos del mismo {@code (year, type)}
 *       — espejo de {@code PERIOD_DATE_OVERLAP}.</li>
 * </ol>
 *
 * <p>El timeline preview pinta el rango candidato:
 * <ul>
 *   <li><span style="color: #1d4ed8">azul punteado</span> si pasa la
 *       validación local.</li>
 *   <li><span style="color: #dc2626">rojo</span> si solapa con otro
 *       periodo existente del mismo type.</li>
 * </ul>
 * El submit queda deshabilitado mientras hay conflict.</p>
 */
@Component({
  selector: 'app-period-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconComponent,
    SpinnerComponent,
    PeriodTimelineComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-form-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="period-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">
              Cada periodo (Bimestre / Trimestre / Anual) debe caber dentro del rango del año
              académico y no solapar con sus pares del mismo tipo.
            </p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="cancel()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card-body grid gap-4">
          @if (errorBanner(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ err }}</p>
            </div>
          }

          @if (yearLocked()) {
            <div class="alert alert-warning">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">
                El año seleccionado está <strong>cerrado</strong>. No se pueden crear ni modificar
                periodos.
              </p>
            </div>
          }

          <div class="grid gap-4 sm:grid-cols-12">
            <div class="field sm:col-span-12">
              <label class="label" for="period-year">Año académico *</label>
              <select id="period-year" class="select" formControlName="academicYearPublicUuid">
                <option [ngValue]="null" disabled>Selecciona un año…</option>
                @for (y of years(); track y.publicUuid) {
                  <option [ngValue]="y.publicUuid">
                    {{ y.name }} · {{ statusLabel(y.status) }}
                  </option>
                }
              </select>
              @if (editing()) {
                <p class="field-hint">El año no se puede modificar después de crear el periodo.</p>
              }
            </div>

            <div class="field sm:col-span-4">
              <label class="label" for="period-type">Tipo *</label>
              <select id="period-type" class="select" formControlName="periodType">
                <option [ngValue]="null" disabled>Tipo…</option>
                @for (t of periodTypeOptions; track t.value) {
                  <option [ngValue]="t.value">{{ t.label }}</option>
                }
              </select>
              @if (editing()) {
                <p class="field-hint">Inmutable después de crear.</p>
              }
            </div>

            <div class="field sm:col-span-3">
              <label class="label" for="period-ordinal">Ordinal *</label>
              <input
                id="period-ordinal"
                type="number"
                class="input"
                formControlName="ordinal"
                min="1"
                step="1"
              />
              @if (showError('ordinal'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else if (!editing()) {
                <p class="field-hint">Sugerencia: siguiente disponible.</p>
              } @else {
                <p class="field-hint">Inmutable. Borra y recrea para renumerar.</p>
              }
            </div>

            <div class="field sm:col-span-5">
              <label class="label" for="period-name">
                Nombre <span class="text-xs text-content-muted">(opcional)</span>
              </label>
              <input
                id="period-name"
                type="text"
                class="input"
                formControlName="name"
                maxlength="60"
                [placeholder]="autoNamePlaceholder()"
              />
              <p class="field-hint">
                Si lo dejas vacío se autogenera (ej. "{{ autoNamePlaceholder() }}").
              </p>
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="period-start">Fecha inicio *</label>
              <input
                id="period-start"
                type="date"
                class="input"
                formControlName="startDate"
                [min]="yearStartIso()"
                [max]="yearEndIso()"
              />
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="period-end">Fecha fin *</label>
              <input
                id="period-end"
                type="date"
                class="input"
                formControlName="endDate"
                [min]="yearStartIso()"
                [max]="yearEndIso()"
              />
            </div>
          </div>

          <!-- Timeline preview -->
          @if (selectedYear(); as y) {
            <section class="rounded-md bg-surface-subtle p-3">
              <p class="mb-2 text-xs font-medium text-content-muted">
                Vista previa
                @if (overlappingNames().length > 0) {
                  ·
                  <span class="text-danger-600 font-semibold">
                    Solapa con: {{ overlappingNames().join(', ') }}
                  </span>
                } @else if (validationMessage()) {
                  · <span class="text-danger-600">{{ validationMessage() }}</span>
                }
              </p>
              <app-period-timeline
                [yearStart]="y.startDate"
                [yearEnd]="y.endDate"
                [periods]="otherPeriodsForYear()"
                [preview]="previewItems()"
              />
            </section>
          }

          <footer class="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">Cancelar</button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="!canSubmit() || saving()"
              [title]="submitTooltip()"
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
      </div>
    </div>
  `,
})
export class PeriodFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AcademicStore);

  readonly period = input<AcademicPeriodDetail | null>(null);
  readonly defaultYearUuid = input<string | null>(null);
  readonly defaultPeriodType = input<PeriodType | null>(null);

  readonly closed = output<void>();
  readonly saved = output<AcademicPeriodDetail>();

  protected readonly years = this.store.years;
  protected readonly periods = this.store.periods;
  protected readonly saving = this.store.savingPeriod;
  protected readonly errorBanner = this.store.error;

  protected readonly editing = computed(() => this.period() !== null);
  protected readonly title = computed(() => (this.editing() ? 'Editar periodo' : 'Nuevo periodo'));
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear periodo',
  );

  protected readonly periodTypeOptions: ReadonlyArray<{
    value: PeriodType;
    label: string;
  }> = (Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map((v) => ({
    value: v,
    label: PERIOD_TYPE_LABELS[v],
  }));

  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form: FormGroup = this.fb.group({
    academicYearPublicUuid: [null as string | null, [Validators.required]],
    periodType: [null as PeriodType | null, [Validators.required]],
    ordinal: [1, [Validators.required, Validators.min(1)]],
    name: ['', [Validators.maxLength(60)]],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
  });

  /** Signal con todos los valueChanges del form (sirve a los computed). */
  private readonly formValue = signal(this.form.getRawValue());

  // --- Selecciones derivadas --------------------------------------------------

  protected readonly selectedYear = computed<AcademicYearRow | null>(() => {
    const id = this.formValue().academicYearPublicUuid;
    if (!id) return null;
    return this.years().find((y) => y.publicUuid === id) ?? null;
  });

  protected readonly yearLocked = computed<boolean>(() => {
    const y = this.selectedYear();
    return !!y && y.status === AcademicYearStatus.Closed;
  });

  protected readonly yearStartIso = computed<string>(() => {
    const y = this.selectedYear();
    return y ? toLocalDateString(y.startDate) : '';
  });

  protected readonly yearEndIso = computed<string>(() => {
    const y = this.selectedYear();
    return y ? toLocalDateString(y.endDate) : '';
  });

  /** Periodos del mismo year + type que el form actual, salvo el editado. */
  protected readonly otherPeriodsForYear = computed<AcademicPeriodRow[]>(() => {
    const yearId = this.formValue().academicYearPublicUuid;
    if (!yearId) return [];
    const editingId = this.period()?.publicUuid;
    return this.periods().filter(
      (p) => p.academicYearPublicUuid === yearId && (!editingId || p.publicUuid !== editingId),
    );
  });

  /** Nombre auto-sugerido (espejo del backend) según ordinal+type vigentes. */
  protected readonly autoNamePlaceholder = computed<string>(() => {
    const v = this.formValue();
    if (!v.periodType || !v.ordinal) return 'I Bimestre';
    return defaultPeriodName(v.ordinal, v.periodType);
  });

  /** Periodos solapados con el rango actual del form. */
  private readonly overlappingPeriods = computed<AcademicPeriodRow[]>(() => {
    const v = this.formValue();
    if (!v.academicYearPublicUuid || !v.periodType) return [];
    const start = parseDateOrNull(v.startDate);
    const end = parseDateOrNull(v.endDate);
    if (!start || !end || !isDateRangeValid(start, end)) return [];
    return findOverlappingPeriods(
      this.periods(),
      v.academicYearPublicUuid,
      v.periodType,
      start,
      end,
      this.period()?.publicUuid,
    );
  });

  protected readonly overlappingNames = computed<string[]>(() =>
    this.overlappingPeriods().map((p) => p.name),
  );

  /** Mensaje de validación local (sin contar overlap, que tiene su propio chip). */
  protected readonly validationMessage = computed<string | null>(() => {
    const v = this.formValue();
    const start = parseDateOrNull(v.startDate);
    const end = parseDateOrNull(v.endDate);
    if (!start || !end) return null;
    if (!isDateRangeValid(start, end)) {
      return 'La fecha de inicio debe ser anterior a la fecha de fin.';
    }
    const y = this.selectedYear();
    if (y && !isWithinYear(start, end, y.startDate, y.endDate)) {
      return 'El rango debe caber dentro del año académico seleccionado.';
    }
    return null;
  });

  /** Items para el preview del timeline (uno solo: el rango candidato). */
  protected readonly previewItems = computed<TimelinePreviewItem[]>(() => {
    const v = this.formValue();
    const start = parseDateOrNull(v.startDate);
    const end = parseDateOrNull(v.endDate);
    if (!v.periodType || !v.ordinal || !start || !end || !isDateRangeValid(start, end)) {
      return [];
    }
    const conflict = this.overlappingPeriods().length > 0;
    return [
      {
        id: 'candidate',
        periodType: v.periodType,
        ordinal: v.ordinal,
        name: (v.name && v.name.trim()) || defaultPeriodName(v.ordinal, v.periodType),
        startDate: start,
        endDate: end,
        conflict,
      },
    ];
  });

  protected readonly canSubmit = computed<boolean>(() => {
    if (this.form.invalid) return false;
    if (this.yearLocked()) return false;
    if (this.validationMessage()) return false;
    if (this.overlappingPeriods().length > 0) return false;
    return true;
  });

  protected readonly submitTooltip = computed<string>(() => {
    if (this.yearLocked()) return 'El año está cerrado';
    if (this.validationMessage()) return this.validationMessage()!;
    const overlap = this.overlappingNames();
    if (overlap.length > 0) return `Solapa con: ${overlap.join(', ')}`;
    return '';
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  constructor() {
    /* Mantén `formValue` sincronizado con cualquier cambio del form
     * (incluyendo patchValue y setValue). Sin esto, los computed
     * basados en el value no se reevalúan al editar. */
    effect((onCleanup) => {
      const sub = this.form.valueChanges.subscribe(() => {
        this.formValue.set(this.form.getRawValue());
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  ngOnInit(): void {
    this.store.clearError();

    const p = this.period();
    if (p) {
      this.form.patchValue({
        academicYearPublicUuid: p.academicYearPublicUuid,
        periodType: p.periodType,
        ordinal: p.ordinal,
        name: p.name,
        startDate: toLocalDateString(p.startDate),
        endDate: toLocalDateString(p.endDate),
      });
      /* En edit, year/type/ordinal son inmutables (mismo trade-off
       * que sections — el BE rechaza renumerar; conviene
       * delete & recreate). */
      this.form.get('academicYearPublicUuid')?.disable();
      this.form.get('periodType')?.disable();
      this.form.get('ordinal')?.disable();
    } else {
      this.hydrateDefaults();
    }
    this.formValue.set(this.form.getRawValue());
  }

  private hydrateDefaults(): void {
    const yearUuid = this.defaultYearUuid() ?? this.store.currentActive()?.publicUuid ?? null;
    const periodType = this.defaultPeriodType() ?? PeriodType.Bimestre;

    this.form.patchValue({
      academicYearPublicUuid: yearUuid,
      periodType,
      ordinal: yearUuid ? this.store.suggestPeriodOrdinal(yearUuid, periodType) : 1,
      name: '',
    });

    /* Rango por defecto: cubre todo el año si está vacío, o queda
     * vacío para que el admin pinte cualquier sub-rango. Optamos por
     * dejar vacío para no inducir un overlap accidental cuando ya
     * existen periodos. */
  }

  // ===========================================================================
  // Form actions
  // ===========================================================================

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }

  protected cancel(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const start = parseDateOrNull(v.startDate);
    const end = parseDateOrNull(v.endDate);
    if (!start || !end) return;

    const trimmedName = (v.name ?? '').trim();
    const p = this.period();

    try {
      if (p) {
        const patch: Record<string, unknown> = {};
        if (trimmedName !== p.name) patch['name'] = trimmedName;
        if (start.getTime() !== p.startDate.getTime()) {
          patch['startDate'] = toLocalDateString(start);
        }
        if (end.getTime() !== p.endDate.getTime()) {
          patch['endDate'] = toLocalDateString(end);
        }
        if (Object.keys(patch).length === 0) {
          /* No-op: cierra y avisa con el mismo detail. */
          this.saved.emit(p);
          return;
        }
        const updated = await this.store.updatePeriod(p.publicUuid, patch);
        if (updated) this.saved.emit(updated);
      } else {
        const created = await this.store.createPeriod({
          academicYearPublicUuid: v.academicYearPublicUuid as string,
          periodType: v.periodType as PeriodType,
          ordinal: v.ordinal as number,
          name: trimmedName || undefined,
          startDate: toLocalDateString(start),
          endDate: toLocalDateString(end),
        });
        if (created) this.saved.emit(created);
      }
    } catch (err) {
      this.applyServerErrors(err);
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected statusLabel(status: AcademicYearStatus): string {
    switch (status) {
      case AcademicYearStatus.Planning:
        return 'Planificación';
      case AcademicYearStatus.Active:
        return 'Activo';
      case AcademicYearStatus.Closed:
        return 'Cerrado';
    }
  }

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return null;

    const serverErr = this.fieldErrors()[controlName];
    if (serverErr) return serverErr;

    if (!ctrl.touched && !ctrl.dirty) return null;
    if (!ctrl.errors) return null;
    if (ctrl.errors['required']) return 'Campo requerido.';
    if (ctrl.errors['min']) return 'Debe ser ≥ 1.';
    if (ctrl.errors['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    return 'Valor inválido.';
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'PERIOD_DATE_OVERLAP':
        next['startDate'] =
          'El rango solapa con otro periodo. Refresca la lista por si fue creado en otra sesión.';
        break;
      case 'PERIOD_DATE_INVERTED':
        next['endDate'] = 'La fecha de fin debe ser posterior a la de inicio.';
        break;
      case 'PERIOD_OUT_OF_YEAR_RANGE':
        next['startDate'] = 'Las fechas deben estar dentro del rango del año.';
        break;
      case 'PERIOD_ORDINAL_TAKEN':
        next['ordinal'] = 'Ya existe un periodo con este ordinal.';
        break;
      case 'PERIOD_ORDINAL_GAP':
        next['ordinal'] =
          'Los ordinales deben ser contiguos (1, 2, 3…). Usa el siguiente disponible.';
        break;
      case 'ACADEMIC_YEAR_LOCKED':
        next['academicYearPublicUuid'] = 'El año académico está cerrado.';
        break;
      default:
        break;
    }
    this.fieldErrors.set(next);
  }
}

// =============================================================================
// Local helpers
// =============================================================================

function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null;
  try {
    return parseLocalDate(s);
  } catch {
    return null;
  }
}

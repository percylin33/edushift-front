import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { ApiError } from '@core/models';
import {
  IconComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import { AcademicStore } from '../../store';
import {
  AcademicYearDetail,
  CreateAcademicYearRequest,
  UpdateAcademicYearRequest,
  isYearMutable
} from '../../models';

/**
 * Validator a nivel grupo: ambas fechas presentes y
 * {@code startDate < endDate} estrictamente. Devuelve
 * {@code dateRange: true} para que el template lo lea desde
 * {@code form.errors?.['dateRange']}; no afecta a los validators
 * per-campo {@code required}.
 *
 * <p>Vive como función top-level para esquivar el error TS2729
 * (forward reference a un static field desde el inicializador del
 * form en la misma clase).</p>
 */
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as string | null;
  const end = group.get('endDate')?.value as string | null;
  if (!start || !end) return null;
  return start < end ? null : { dateRange: true };
}

/**
 * Form compartido por {@code /academic/years/new} y
 * {@code /academic/years/:id/edit}.
 *
 * <h3>Por qué un solo componente</h3>
 * El campo set de creación y edición coincide al 100%; el modo se
 * detecta por la presencia de {@code :id} en la ruta. Misma decisión
 * que {@code StudentFormComponent}.
 *
 * <h3>Validación</h3>
 * Espejea los constraints del backend ({@code @Size(4, 50)} sobre
 * {@code name}, fechas requeridas, regla {@code startDate < endDate}):
 * <ul>
 *   <li>{@code name}: requerido, 4..50, alfanumérico + espacios + dash.</li>
 *   <li>{@code startDate} / {@code endDate}: requeridos, ambos ISO {@code YYYY-MM-DD}.</li>
 *   <li>Validador a nivel grupo: {@code endDate > startDate} estricto.</li>
 * </ul>
 *
 * <h3>Errores del servidor</h3>
 * Se mapean los códigos del módulo:
 * <ul>
 *   <li>{@code ACADEMIC_YEAR_NAME_TAKEN} → error inline en {@code name}.</li>
 *   <li>{@code ACADEMIC_YEAR_INVALID_DATES} → error inline en
 *       {@code endDate}.</li>
 *   <li>{@code ACADEMIC_YEAR_LOCKED} → banner top-level (intento de
 *       editar año {@code CLOSED}).</li>
 * </ul>
 *
 * <p>Si entramos en modo edición sobre un año {@code CLOSED}, redirigimos
 * a la lista — el backend rechazaría el PUT con {@code 409} y el
 * usuario quedaría atascado en un form que no puede submitear.</p>
 */
@Component({
  selector: 'app-year-form',
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
      eyebrow="Académico · Años"
    >
      <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
        <app-icon name="arrow-left" [size]="16" />
        <span class="hidden sm:inline">Volver</span>
      </a>
    </app-page-header>

    @if (loadingDetail()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando año académico…" />
      </div>
    } @else {
      @if (errorBanner(); as err) {
        <div class="alert alert-danger mb-4">
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
            <h2 class="card-title">Datos del año</h2>
            <p class="card-description">
              Identificación visible y rango de fechas. Los periodos (bimestres,
              trimestres, etc.) se configuran después dentro del año.
            </p>
          </header>

          <div class="card-body grid gap-4 sm:grid-cols-12">
            <div class="field sm:col-span-12">
              <label class="label" for="year-name">Nombre *</label>
              <input
                id="year-name"
                type="text"
                class="input"
                placeholder="2026, 2026-A, 2025-2026, …"
                formControlName="name"
                autocomplete="off"
              />
              @if (showError('name'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">
                  Debe ser único en el workspace. Máximo 50 caracteres.
                </p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="year-start">Fecha inicio *</label>
              <input
                id="year-start"
                type="date"
                class="input"
                formControlName="startDate"
              />
              @if (showError('startDate'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="year-end">Fecha fin *</label>
              <input
                id="year-end"
                type="date"
                class="input"
                formControlName="endDate"
              />
              @if (showError('endDate'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else if (form.errors?.['dateRange']) {
                <p class="field-error">
                  La fecha fin debe ser posterior a la fecha inicio.
                </p>
              }
            </div>
          </div>
        </section>

        <footer class="flex flex-wrap items-center justify-end gap-2">
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">Cancelar</a>
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
export class YearFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AcademicStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly listRoute = ROUTES.ACADEMIC.YEARS.LIST;

  /** publicUuid en modo edición, capturado en {@code ngOnInit}. */
  private editId: string | null = null;
  protected readonly editing = signal(false);

  protected readonly saving = this.store.savingYear;
  protected readonly loadingDetail = this.store.loadingYearDetail;
  protected readonly errorBanner = this.store.error;

  /** Errores per-campo aportados por el backend. */
  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly title = computed(() =>
    this.editing() ? 'Editar año académico' : 'Nuevo año académico'
  );
  protected readonly subtitle = computed(() =>
    this.editing()
      ? 'Actualiza el rango y el nombre del año. Los años cerrados no son editables.'
      : 'Crea un año en estado Planificación. Podrás activarlo después desde la lista.'
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear año'
  );

  /**
   * Reactive form. Validators alineados con el backend; el grupo lleva
   * además {@link YearFormComponent#dateRangeValidator} para el cruce
   * {@code startDate < endDate} (Angular no expone validadores
   * cruzados sin un helper a nivel grupo).
   */
  protected readonly form: FormGroup = this.fb.group(
    {
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(4),
          Validators.maxLength(50),
          Validators.pattern(/^[A-Za-z0-9 \-]+$/)
        ]
      ],
      startDate: [null as string | null, [Validators.required]],
      endDate: [null as string | null, [Validators.required]]
    },
    { validators: [dateRangeValidator] }
  );

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    const id = this.route.snapshot.paramMap.get('id');
    this.editId = id;
    this.editing.set(!!id);

    if (id) {
      const detail = await this.store.loadYearDetail(id);
      if (!detail) {
        await this.router.navigate([ROUTES.ACADEMIC.YEARS.LIST]);
        return;
      }
      if (!isYearMutable(detail.status)) {
        /* CLOSED: el backend rechazaría el PUT — devolver al usuario
         * a la lista en vez de mostrarle un form que no puede enviar. */
        await this.router.navigate([ROUTES.ACADEMIC.YEARS.LIST]);
        return;
      }
      this.hydrateFrom(detail);
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

    const id = this.editId;
    try {
      if (id) {
        const patch = this.toUpdateRequest();
        const updated = await this.store.updateYear(id, patch);
        if (updated) {
          await this.router.navigate([ROUTES.ACADEMIC.YEARS.LIST]);
        }
      } else {
        const request = this.toCreateRequest();
        const created = await this.store.createYear(request);
        if (created) {
          await this.router.navigate([ROUTES.ACADEMIC.YEARS.LIST]);
        }
      }
    }
    catch (err) {
      this.applyServerErrors(err);
    }
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
    if (ctrl.errors['pattern']) {
      return 'Solo letras, dígitos, espacios y guiones.';
    }
    return 'Valor inválido.';
  }

  private hydrateFrom(detail: AcademicYearDetail): void {
    this.form.patchValue({
      name: detail.name,
      startDate: this.toDateInput(detail.startDate),
      endDate: this.toDateInput(detail.endDate)
    });
  }

  private toCreateRequest(): CreateAcademicYearRequest {
    const v = this.form.getRawValue();
    return {
      name: (v.name ?? '').trim(),
      startDate: v.startDate as string,
      endDate: v.endDate as string
    };
  }

  /**
   * El backend permite PATCH parcial; sin embargo este form expone
   * los tres campos y siempre los envía juntos para alinearse con
   * la UX (ver el form completo, guardar lo que se ve). El servidor
   * trata valores idénticos como no-op, así que es safe.
   */
  private toUpdateRequest(): UpdateAcademicYearRequest {
    const v = this.form.getRawValue();
    return {
      name: (v.name ?? '').trim(),
      startDate: v.startDate as string,
      endDate: v.endDate as string
    };
  }

  /**
   * Convierte un {@link Date} (en UTC) al {@code YYYY-MM-DD} que
   * espera el {@code <input type="date">}.
   */
  private toDateInput(date: Date | undefined): string | null {
    if (!date) return null;
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'ACADEMIC_YEAR_NAME_TAKEN':
        next['name'] = 'Ya existe un año con este nombre en el workspace.';
        break;
      case 'ACADEMIC_YEAR_INVALID_DATES':
        next['endDate'] = 'El rango de fechas no es válido.';
        break;
      default:
        break;
    }
    this.fieldErrors.set(next);
  }

}

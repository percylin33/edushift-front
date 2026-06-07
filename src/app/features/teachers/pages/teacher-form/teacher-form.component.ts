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
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { DocumentType, EmploymentStatus, Gender } from '@core/enums';
import { ApiError } from '@core/models';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import { SpecializationInputComponent } from '../../components';
import { TeachersStore } from '../../store';
import {
  CreateTeacherRequest,
  EMPLOYMENT_STATUS_LABELS,
  TeacherDetail,
  UpdateTeacherRequest
} from '../../models';

/**
 * Form compartido para {@code /teachers/new} y {@code /teachers/:id/edit}.
 *
 * <h3>Por qué un solo componente</h3>
 * Mismo set de campos y validaciones — splittear duplicaría el
 * template entero. El modo se infiere del param de ruta {@code :id}:
 * presente → hidratamos desde el store y mandamos PUT; ausente → POST.
 *
 * <h3>Validación</h3>
 * Espejea las constraints del back ({@code CreateTeacherRequest}) para
 * que la UI atrape los casos obvios sin round-trip:
 * <ul>
 *   <li>{@code documentNumber}: required, 1–20 chars.</li>
 *   <li>{@code firstName} / {@code lastName}: required, 1–100.</li>
 *   <li>{@code email}: opcional pero formato válido (1..254).</li>
 *   <li>{@code phone}: opcional, regex {@code ^[+0-9\\s\\-()]{6,32}$}.</li>
 *   <li>Cada specialization: 1..100 (lo enforce el chip-input).</li>
 * </ul>
 *
 * <h3>Mapeo de errores BE</h3>
 * <ul>
 *   <li>409 {@code TEACHER_DOCUMENT_TAKEN} → field {@code documentNumber}.</li>
 *   <li>409 {@code TEACHER_EMAIL_TAKEN} → field {@code email}.</li>
 *   <li>cualquier otro → banner top.</li>
 * </ul>
 */
@Component({
  selector: 'app-teacher-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    SpecializationInputComponent
  ],
  template: `
    <app-page-container size="default">
      <app-page-header
        [title]="title()"
        [subtitle]="subtitle()"
      >
        <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </a>
      </app-page-header>

      @if (errorBanner(); as err) {
        <div class="alert alert-danger mb-4">
          <app-icon name="alert-circle" [size]="18" />
          <p class="flex-1 text-sm">{{ err }}</p>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card">
        <div class="card-body grid gap-5">
          <fieldset class="grid gap-4 sm:grid-cols-12">
            <legend class="col-span-12 text-sm font-semibold text-content">
              Identificación
            </legend>

            <div class="field sm:col-span-3">
              <label class="label" for="docType">Tipo de documento *</label>
              <select id="docType" class="select" formControlName="documentType">
                @for (opt of docTypeOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <div class="field sm:col-span-9">
              <label class="label" for="docNumber">Número de documento *</label>
              <input
                id="docNumber"
                type="text"
                class="input"
                formControlName="documentNumber"
                maxlength="20"
                autocomplete="off"
              />
              @if (showError('documentNumber'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-4">
              <label class="label" for="firstName">Nombres *</label>
              <input
                id="firstName"
                type="text"
                class="input"
                formControlName="firstName"
                maxlength="100"
              />
              @if (showError('firstName'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-4">
              <label class="label" for="lastName">Apellido paterno *</label>
              <input
                id="lastName"
                type="text"
                class="input"
                formControlName="lastName"
                maxlength="100"
              />
              @if (showError('lastName'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-4">
              <label class="label" for="secondLastName">Apellido materno</label>
              <input
                id="secondLastName"
                type="text"
                class="input"
                formControlName="secondLastName"
                maxlength="100"
              />
            </div>

            <div class="field sm:col-span-4">
              <label class="label" for="birthDate">Fecha de nacimiento</label>
              <input
                id="birthDate"
                type="date"
                class="input"
                formControlName="birthDate"
              />
            </div>

            <div class="field sm:col-span-4">
              <label class="label" for="gender">Género</label>
              <select id="gender" class="select" formControlName="gender">
                <option [ngValue]="null">Sin especificar</option>
                @for (opt of genderOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>
          </fieldset>

          <fieldset class="grid gap-4 sm:grid-cols-12">
            <legend class="col-span-12 text-sm font-semibold text-content">
              Contacto
            </legend>

            <div class="field sm:col-span-6">
              <label class="label" for="email">Email</label>
              <input
                id="email"
                type="email"
                class="input"
                formControlName="email"
                maxlength="254"
                autocomplete="off"
              />
              @if (showError('email'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">
                  Necesario para invitarlo al sistema con un enlace de activación.
                </p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="phone">Teléfono</label>
              <input
                id="phone"
                type="tel"
                class="input"
                formControlName="phone"
                maxlength="32"
                placeholder="+51 999 888 777"
              />
              @if (showError('phone'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>
          </fieldset>

          <fieldset class="grid gap-4 sm:grid-cols-12">
            <legend class="col-span-12 text-sm font-semibold text-content">
              Datos académicos
            </legend>

            <div class="field sm:col-span-6">
              <label class="label" for="title">Título profesional</label>
              <input
                id="title"
                type="text"
                class="input"
                formControlName="title"
                maxlength="50"
                placeholder="Lic. en Educación, Mg. en Psicología…"
              />
            </div>

            <div class="field sm:col-span-3">
              <label class="label" for="hireDate">Fecha de contratación</label>
              <input
                id="hireDate"
                type="date"
                class="input"
                formControlName="hireDate"
              />
            </div>

            <div class="field sm:col-span-3">
              <label class="label" for="employmentStatus">Estado laboral</label>
              <select
                id="employmentStatus"
                class="select"
                formControlName="employmentStatus"
              >
                <option [ngValue]="null">Activo (default)</option>
                @for (opt of statusOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <div class="field sm:col-span-12">
              <label class="label" for="specializations">Especialidades</label>
              <app-specialization-input
                id="specializations"
                formControlName="specializations"
              />
              <p class="field-hint">
                Empieza a tipear y elige del catálogo o presiona Enter para
                agregar una especialidad libre.
              </p>
            </div>
          </fieldset>
        </div>

        <footer class="card-footer">
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
    </app-page-container>
  `
})
export class TeacherFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(TeachersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly listRoute = ROUTES.TEACHERS.LIST;

  protected readonly editing = signal<boolean>(false);
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = computed<string | null>(() => {
    const err = this.store.error();
    if (!err) return null;
    /* Si el error ya se mapeó a un campo, no spameamos el banner. */
    return Object.keys(this.fieldErrors()).length > 0 ? null : err;
  });

  protected readonly title = computed(() =>
    this.editing() ? 'Editar docente' : 'Nuevo docente'
  );
  protected readonly subtitle = computed(() =>
    this.editing()
      ? 'Actualiza los datos del docente. Los cambios se aplican al guardar.'
      : 'Da de alta un docente. Podrás invitarlo al sistema desde el detalle.'
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear docente'
  );

  private readonly fieldErrors = signal<Record<string, string>>({});
  private editId: string | null = null;

  protected readonly docTypeOptions: ReadonlyArray<{
    value: DocumentType;
    label: string;
  }> = [
    { value: DocumentType.Dni,      label: 'DNI' },
    { value: DocumentType.Ce,       label: 'Carnet de Extranjería' },
    { value: DocumentType.Passport, label: 'Pasaporte' },
    { value: DocumentType.Other,    label: 'Otro' }
  ];

  protected readonly genderOptions: ReadonlyArray<{
    value: Gender;
    label: string;
  }> = [
    { value: Gender.Female,       label: 'Femenino' },
    { value: Gender.Male,         label: 'Masculino' },
    { value: Gender.Other,        label: 'Otro' },
    { value: Gender.NotSpecified, label: 'Sin especificar' }
  ];

  protected readonly statusOptions: ReadonlyArray<{
    value: EmploymentStatus;
    label: string;
  }> = (Object.values(EmploymentStatus) as EmploymentStatus[]).map((v) => ({
    value: v,
    label: EMPLOYMENT_STATUS_LABELS[v]
  }));

  protected readonly form: FormGroup = this.fb.group({
    documentType: [DocumentType.Dni, [Validators.required]],
    documentNumber: [
      '',
      [Validators.required, Validators.minLength(1), Validators.maxLength(20)]
    ],
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    secondLastName: ['', [Validators.maxLength(100)]],
    birthDate: [null as string | null],
    gender: [null as Gender | null],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: [
      '',
      [Validators.maxLength(32), Validators.pattern(/^[+0-9\s\-()]{6,32}$/)]
    ],
    title: ['', [Validators.maxLength(50)]],
    specializations: [[] as string[]],
    hireDate: [null as string | null],
    employmentStatus: [null as EmploymentStatus | null]
  });

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    const id = this.route.snapshot.paramMap.get('id');
    this.editId = id;
    this.editing.set(!!id);

    if (id) {
      const detail = await this.store.loadDetail(id);
      if (detail) {
        this.hydrateFrom(detail);
      } else {
        await this.router.navigate([ROUTES.TEACHERS.LIST]);
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
    this.fieldErrors.set({});

    const id = this.editId;
    try {
      if (id) {
        const patch = this.toUpdateRequest();
        const updated = await this.store.update(id, patch);
        if (updated) {
          await this.router.navigate([ROUTES.TEACHERS.detail(updated.publicUuid)]);
        } else {
          this.applyServerErrorsFromStore();
        }
      } else {
        const request = this.toCreateRequest();
        const created = await this.store.create(request);
        if (created) {
          await this.router.navigate([ROUTES.TEACHERS.detail(created.publicUuid)]);
        } else {
          this.applyServerErrorsFromStore();
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
    if (ctrl.errors['email']) return 'Formato de email inválido.';
    if (ctrl.errors['minlength']) {
      return `Debe tener al menos ${ctrl.errors['minlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors['maxlength']) {
      return `Debe tener como máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors['pattern']) {
      return 'Formato inválido. Solo dígitos, espacios, guiones y un + opcional al inicio.';
    }
    return 'Valor inválido.';
  }

  private hydrateFrom(detail: TeacherDetail): void {
    this.form.patchValue({
      documentType: detail.documentType,
      documentNumber: detail.documentNumber,
      firstName: detail.firstName,
      lastName: detail.lastName,
      secondLastName: detail.secondLastName ?? '',
      birthDate: this.toDateInput(detail.birthDate),
      gender: detail.gender ?? null,
      email: detail.email ?? '',
      phone: detail.phone ?? '',
      title: detail.title ?? '',
      specializations: [...detail.specializations],
      hireDate: this.toDateInput(detail.hireDate),
      employmentStatus: detail.employmentStatus
    });
  }

  private toCreateRequest(): CreateTeacherRequest {
    const v = this.form.getRawValue();
    return {
      documentType: v.documentType,
      documentNumber: v.documentNumber.trim(),
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      secondLastName: this.optionalString(v.secondLastName),
      birthDate: this.optionalString(v.birthDate),
      gender: this.optionalEnum<Gender>(v.gender),
      email: this.optionalString(v.email),
      phone: this.optionalString(v.phone),
      title: this.optionalString(v.title),
      specializations: v.specializations.length > 0 ? v.specializations : undefined,
      hireDate: this.optionalString(v.hireDate),
      employmentStatus: this.optionalEnum<EmploymentStatus>(v.employmentStatus)
    };
  }

  private toUpdateRequest(): UpdateTeacherRequest {
    const v = this.form.getRawValue();
    /* En edit forwarded el array tal cual (incluyendo []) para que
     * el back lo persista vacío si el admin removió todas las
     * especialidades. {@code undefined} sería "no change" y no es lo
     * que queremos en este caso. */
    return {
      documentType: v.documentType,
      documentNumber: v.documentNumber.trim(),
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      secondLastName: v.secondLastName.trim(),
      birthDate: this.optionalString(v.birthDate),
      gender: this.optionalEnum<Gender>(v.gender),
      email: v.email.trim(),
      phone: v.phone.trim(),
      title: v.title.trim(),
      specializations: v.specializations,
      hireDate: this.optionalString(v.hireDate),
      employmentStatus: this.optionalEnum<EmploymentStatus>(v.employmentStatus)
    };
  }

  private optionalString(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private optionalEnum<T>(value: T | null | undefined): T | undefined {
    return value === null || value === undefined ? undefined : value;
  }

  private toDateInput(date: Date | undefined): string | null {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * El store devuelve {@code null} en el create/update y guarda el
   * mensaje en {@code error()}. Si el error trae un código mapeable
   * a campo lo movemos a {@code fieldErrors}; si no, queda en el
   * banner top.
   */
  private applyServerErrorsFromStore(): void {
    const msg = this.store.error();
    if (!msg) return;
    /* Heurística cheap: el mensaje del backend suele incluir el code
     * (`ApiError.code`). Cuando el caller real ataja {@link HttpErrorResponse}
     * desde {@link #onSubmit}, el {@code applyServerErrors} hace el mapeo
     * preciso. Acá sólo dejamos el banner. */
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'TEACHER_DOCUMENT_TAKEN':
        next['documentNumber'] = 'Ya existe un docente con este documento.';
        break;
      case 'TEACHER_EMAIL_TAKEN':
        next['email'] = 'Ya existe un docente con este email.';
        break;
      default:
        break;
    }
    this.fieldErrors.set(next);
  }
}

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { DocumentType, EnrollmentStatus, Gender } from '@core/enums';
import { ApiError } from '@core/models';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { StudentsStore } from '../../store';
import { CreateStudentRequest, StudentDetail, UpdateStudentRequest } from '../../models';

/**
 * Shared form for {@code /students/new} and {@code /students/:id/edit}.
 *
 * <h3>Why one component, not two</h3>
 * Create and edit cover the same field set with the same validation —
 * splitting them would duplicate the entire template. Mode is detected
 * from the route param: a present {@code :id} means we hydrate the
 * form from the store and submit a PATCH; otherwise we submit a POST.
 *
 * <h3>Validation</h3>
 * Mirrors the backend constraints so the UI catches the obvious cases
 * before the round-trip:
 * <ul>
 *   <li>{@code documentNumber}: required, 4–20 chars, alnum + dash.</li>
 *   <li>{@code firstName} / {@code lastName}: required, 1–100.</li>
 *   <li>Optional fields enforce only the size cap; everything else
 *       falls through to the backend's authoritative validation.</li>
 * </ul>
 *
 * <h3>Error handling</h3>
 * Backend codes ({@code STUDENT_DOCUMENT_TAKEN},
 * {@code STUDENT_EMAIL_TAKEN}, {@code VALIDATION_ERROR}) map to either
 * field-level errors or a top-level banner. Generic 500s fall through
 * to the global HTTP interceptor.
 */
@Component({
  selector: 'app-student-form',
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
  ],
  template: `
    <app-page-container size="default">
      <app-page-header [title]="title()" [subtitle]="subtitle()" eyebrow="Estudiantes">
        <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
          <app-icon name="arrow-left" [size]="16" />
          <span class="hidden sm:inline">Volver</span>
        </a>
      </app-page-header>

      @if (loadingDetail()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando estudiante…" />
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
              <h2 class="card-title">Identidad</h2>
              <p class="card-description">Documento y nombre del estudiante.</p>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-12">
              <div class="field sm:col-span-3">
                <label class="label" for="documentType">Tipo *</label>
                <select id="documentType" class="select" formControlName="documentType">
                  @for (opt of documentTypeOptions; track opt.value) {
                    <option [ngValue]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </div>

              <div class="field sm:col-span-9">
                <label class="label" for="documentNumber">Número de documento *</label>
                <input
                  id="documentNumber"
                  type="text"
                  class="input"
                  placeholder="Ej. 12345678"
                  formControlName="documentNumber"
                  autocomplete="off"
                />
                @if (showError('documentNumber'); as err) {
                  <p class="error">{{ err }}</p>
                }
              </div>

              <div class="field sm:col-span-6">
                <label class="label" for="firstName">Nombres *</label>
                <input
                  id="firstName"
                  type="text"
                  class="input"
                  formControlName="firstName"
                  autocomplete="given-name"
                />
                @if (showError('firstName'); as err) {
                  <p class="error">{{ err }}</p>
                }
              </div>

              <div class="field sm:col-span-6">
                <label class="label" for="lastName">Apellido paterno *</label>
                <input
                  id="lastName"
                  type="text"
                  class="input"
                  formControlName="lastName"
                  autocomplete="family-name"
                />
                @if (showError('lastName'); as err) {
                  <p class="error">{{ err }}</p>
                }
              </div>

              <div class="field sm:col-span-6">
                <label class="label" for="secondLastName">Apellido materno</label>
                <input
                  id="secondLastName"
                  type="text"
                  class="input"
                  formControlName="secondLastName"
                />
                @if (showError('secondLastName'); as err) {
                  <p class="error">{{ err }}</p>
                }
              </div>

              <div class="field sm:col-span-3">
                <label class="label" for="birthDate">Nacimiento</label>
                <input id="birthDate" type="date" class="input" formControlName="birthDate" />
              </div>

              <div class="field sm:col-span-3">
                <label class="label" for="gender">Género</label>
                <select id="gender" class="select" formControlName="gender">
                  <option [ngValue]="null">Sin especificar</option>
                  @for (opt of genderOptions; track opt.value) {
                    <option [ngValue]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <h2 class="card-title">Contacto</h2>
              <p class="card-description">Datos opcionales que ayudan al equipo administrativo.</p>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-12">
              <div class="field sm:col-span-6">
                <label class="label" for="email">Email</label>
                <input
                  id="email"
                  type="email"
                  class="input"
                  placeholder="estudiante@colegio.edu"
                  formControlName="email"
                  autocomplete="email"
                />
                @if (showError('email'); as err) {
                  <p class="error">{{ err }}</p>
                }
              </div>

              <div class="field sm:col-span-6">
                <label class="label" for="phone">Teléfono</label>
                <input
                  id="phone"
                  type="tel"
                  class="input"
                  formControlName="phone"
                  autocomplete="tel"
                />
                @if (showError('phone'); as err) {
                  <p class="error">{{ err }}</p>
                }
              </div>

              <div class="field sm:col-span-12">
                <label class="label" for="address">Dirección</label>
                <textarea id="address" class="input" rows="2" formControlName="address"></textarea>
                @if (showError('address'); as err) {
                  <p class="error">{{ err }}</p>
                }
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <h2 class="card-title">Matrícula</h2>
              <p class="card-description">
                Si lo dejas en blanco, el sistema lo crea como
                <strong>Pendiente</strong>.
              </p>
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-12">
              <div class="field sm:col-span-6">
                <label class="label" for="enrollmentStatus">Estado</label>
                <select id="enrollmentStatus" class="select" formControlName="enrollmentStatus">
                  <option [ngValue]="null">Sin definir</option>
                  @for (opt of statusOptions; track opt.value) {
                    <option [ngValue]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </div>

              <div class="field sm:col-span-6">
                <label class="label" for="enrollmentDate">Fecha</label>
                <input
                  id="enrollmentDate"
                  type="date"
                  class="input"
                  formControlName="enrollmentDate"
                />
              </div>

              @if (!editing()) {
                <div class="field sm:col-span-12">
                  <label class="label" for="sectionPublicUuid">
                    Sección del año activo
                    <span class="text-xs text-content-muted">(opcional)</span>
                  </label>
                  @if (loadingSections()) {
                    <p class="text-xs text-content-muted">Cargando secciones disponibles…</p>
                  } @else if (!activeYear()) {
                    <p class="text-xs text-content-muted">
                      No hay año académico activo. Crea y activa uno desde
                      <em>Académico</em> para matricular en el momento de registrar al estudiante.
                    </p>
                  } @else if (sections().length === 0) {
                    <p class="text-xs text-content-muted">
                      El año {{ activeYear()?.name }} no tiene secciones. Crea al menos una desde
                      <em>Académico → Secciones</em>
                      para usar este atajo.
                    </p>
                  } @else {
                    <select
                      id="sectionPublicUuid"
                      class="select"
                      formControlName="sectionPublicUuid"
                    >
                      <option [ngValue]="null">No matricular ahora</option>
                      @for (s of sections(); track s.publicUuid) {
                        <option [ngValue]="s.publicUuid">
                          {{ s.gradeName }} · {{ s.name }} ({{ s.levelCode }})
                        </option>
                      }
                    </select>
                    <p class="hint mt-1 text-xs text-content-muted">
                      Si seleccionas una sección, el sistema crea automáticamente la matrícula
                      activa después del alta del estudiante.
                    </p>
                  }
                </div>
              }
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
    </app-page-container>
  `,
})
export class StudentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(StudentsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly academicApi = inject(AcademicApiService);

  protected readonly listRoute = ROUTES.STUDENTS.LIST;

  /**
   * Año académico ACTIVE del tenant — gateway de la matrícula opcional.
   * Cargado una sola vez en {@link ngOnInit} cuando estamos en modo
   * <em>create</em>; en edit no aplica porque las matrículas se
   * gestionan desde el detail.
   */
  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly loadingSections = signal<boolean>(false);

  /** Edit-mode public UUID, captured once at init. */
  private editId: string | null = null;
  protected readonly editing = signal(false);

  protected readonly saving = this.store.saving;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly errorBanner = this.store.error;

  /** Per-field server-side errors keyed by control name. */
  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly title = computed(() =>
    this.editing() ? 'Editar estudiante' : 'Nuevo estudiante',
  );
  protected readonly subtitle = computed(() =>
    this.editing()
      ? 'Actualiza los datos del estudiante; los campos en blanco se mantienen.'
      : 'Completa los datos básicos para registrarlo en el workspace.',
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear estudiante',
  );

  protected readonly documentTypeOptions: ReadonlyArray<{ value: DocumentType; label: string }> = [
    { value: DocumentType.Dni, label: 'DNI' },
    { value: DocumentType.Ce, label: 'CE' },
    { value: DocumentType.Passport, label: 'Pasaporte' },
    { value: DocumentType.Other, label: 'Otro' },
  ];

  protected readonly genderOptions: ReadonlyArray<{ value: Gender; label: string }> = [
    { value: Gender.Female, label: 'Femenino' },
    { value: Gender.Male, label: 'Masculino' },
    { value: Gender.Other, label: 'Otro' },
    { value: Gender.NotSpecified, label: 'Sin especificar' },
  ];

  protected readonly statusOptions: ReadonlyArray<{ value: EnrollmentStatus; label: string }> = [
    { value: EnrollmentStatus.Pending, label: 'Pendiente' },
    { value: EnrollmentStatus.Enrolled, label: 'Matriculado' },
    { value: EnrollmentStatus.Graduated, label: 'Egresado' },
    { value: EnrollmentStatus.Transferred, label: 'Trasladado' },
    { value: EnrollmentStatus.Withdrawn, label: 'Retirado' },
  ];

  /**
   * Reactive form. {@code documentType} defaults to DNI (the most
   * common case in Latin American institutions); the rest start
   * blank. The validators mirror the backend's record annotations so
   * we get fast feedback without redundant server round-trips.
   */
  protected readonly form: FormGroup = this.fb.group({
    documentType: [DocumentType.Dni, [Validators.required]],
    documentNumber: [
      '',
      [
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(20),
        Validators.pattern(/^[A-Za-z0-9-]+$/),
      ],
    ],
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    secondLastName: ['', [Validators.maxLength(100)]],
    birthDate: [null as string | null],
    gender: [null as Gender | null],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.maxLength(32)]],
    address: ['', [Validators.maxLength(500)]],
    enrollmentStatus: [null as EnrollmentStatus | null],
    enrollmentDate: [null as string | null],
    /**
     * Sección opcional al crear (FE-4.7). Cuando está seteada, el
     * {@link onSubmit} encadena {@code enrollStudent} después del
     * {@code create}; si esa segunda mutación falla, se navega al
     * detail con un toast manejado por el store.
     */
    sectionPublicUuid: [null as string | null],
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
        /* Detail load failed (404 / 403 / network); send the user back
         * to the list so they don't get stuck on an empty form bound
         * to a missing aggregate. */
        await this.router.navigate([ROUTES.STUDENTS.LIST]);
      }
    } else {
      /* En modo create cargamos secciones del año activo para el
       * shortcut de matrícula. Si no hay year activo o no hay
       * secciones, el campo se renderiza con un hint inline en lugar
       * del dropdown. */
      void this.fetchActiveYearSections();
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
        const updated = await this.store.update(id, patch);
        if (updated) {
          await this.router.navigate([ROUTES.STUDENTS.detail(updated.publicUuid)]);
        }
      } else {
        const request = this.toCreateRequest();
        const created = await this.store.create(request);
        if (created) {
          /* Si el admin eligió sección, encadenamos la matrícula.
           * El segundo paso falla independiente del primero: el
           * estudiante ya está creado, así que navegamos al detail
           * pase lo que pase y dejamos que el banner del store
           * informe del fallo de enrollment si lo hubo. */
          await this.maybeEnrollAfterCreate(created.publicUuid);
          await this.router.navigate([ROUTES.STUDENTS.detail(created.publicUuid)]);
        }
      }
    } catch (err) {
      this.applyServerErrors(err);
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return null;

    /* Server-side errors win — they reflect the real backend state. */
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
    if (ctrl.errors['pattern']) return 'Solo letras, dígitos y guiones.';
    return 'Valor inválido.';
  }

  private hydrateFrom(detail: StudentDetail): void {
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
      address: detail.address ?? '',
      enrollmentStatus: detail.enrollmentStatus,
      enrollmentDate: this.toDateInput(detail.enrollmentDate),
    });
  }

  /**
   * Build a {@link CreateStudentRequest} dropping empty optional fields
   * so the JSON payload doesn't ship "" for things the backend treats
   * as unset (the entity layer assumes safe defaults when the field
   * is absent, but trims+rejects blanks for fields with size
   * minimums).
   */
  private toCreateRequest(): CreateStudentRequest {
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
      address: this.optionalString(v.address),
      enrollmentStatus: this.optionalEnum<EnrollmentStatus>(v.enrollmentStatus),
      enrollmentDate: this.optionalString(v.enrollmentDate),
    };
  }

  /**
   * Build a {@link UpdateStudentRequest}. {@code undefined} on a key
   * means "no change"; an empty string on a nullable field instructs
   * the backend to clear that column. We forward the trimmed value so
   * "  " in the address textarea doesn't survive.
   */
  private toUpdateRequest(): UpdateStudentRequest {
    const v = this.form.getRawValue();
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
      address: v.address.trim(),
      enrollmentStatus: this.optionalEnum<EnrollmentStatus>(v.enrollmentStatus),
      enrollmentDate: this.optionalString(v.enrollmentDate),
    };
  }

  private optionalString(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * Reactive forms can carry `''` for unset selects (the "Sin especificar"
   * fallback option uses {@code [ngValue]="null"}, but the control still
   * starts as `''` until the user touches it). Normalize empty strings
   * to {@code undefined} so the JSON payload omits the key — Spring's
   * enum binders reject {@code ""} with a "Malformed request" 400.
   */
  private optionalEnum<T>(value: T | '' | null | undefined): T | undefined {
    if (value === null || value === undefined || (value as unknown) === '') {
      return undefined;
    }
    return value as T;
  }

  /**
   * The native {@code <input type="date">} expects {@code YYYY-MM-DD}
   * strings; surface the parsed Date in that shape so the picker
   * shows the value verbatim.
   */
  private toDateInput(date: Date | undefined): string | null {
    if (!date) return null;
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Map server errors. The interceptor wraps responses in our standard
   * envelope; we look for {@code STUDENT_*} codes to surface them
   * inline next to the relevant field, with a generic top banner for
   * everything else.
   */
  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'STUDENT_DOCUMENT_TAKEN':
        next['documentNumber'] = 'Ya existe un estudiante con este documento en el workspace.';
        break;
      case 'STUDENT_EMAIL_TAKEN':
        next['email'] = 'Ya existe un estudiante con este email.';
        break;
      default:
        break;
    }
    this.fieldErrors.set(next);
  }

  /**
   * Carga el año académico ACTIVE + sus secciones para el dropdown
   * de matrícula opcional. Se invoca solo en modo create. Si el
   * fetch falla, dejamos el estado limpio (vacío) y el render
   * cae al hint "no hay año activo".
   */
  private async fetchActiveYearSections(): Promise<void> {
    this.loadingSections.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);
      if (!active) {
        this.sections.set([]);
        return;
      }
      const sections = await firstValueFrom(
        this.academicApi.listSections({
          academicYearPublicUuid: active.publicUuid,
        }),
      );
      this.sections.set(sections);
    } catch {
      this.activeYear.set(null);
      this.sections.set([]);
    } finally {
      this.loadingSections.set(false);
    }
  }

  /**
   * Si el form trae {@code sectionPublicUuid}, encadena
   * {@link StudentsStore#enrollStudent} usando la fecha de hoy y el
   * año académico activo. Mantenemos la llamada aislada del
   * {@code create} para que un fallo aquí no rompa la UX general:
   * el estudiante queda creado y el banner del store muestra el
   * error de matrícula.
   */
  private async maybeEnrollAfterCreate(studentPublicUuid: string): Promise<void> {
    const sectionUuid = this.form.getRawValue().sectionPublicUuid;
    const year = this.activeYear();
    if (!sectionUuid || !year) return;

    /* Local-tz yyyy-MM-dd: {@code toDateInput} usa UTC y puede
     * shiftear el día en zonas con offset negativo (Lima = -05).
     * Construimos la fecha de hoy directamente en local. */
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const enrolledAt = `${yyyy}-${mm}-${dd}`;

    await this.store.enrollStudent(studentPublicUuid, {
      sectionPublicUuid: sectionUuid,
      academicYearPublicUuid: year.publicUuid,
      enrolledAt,
    });
  }
}

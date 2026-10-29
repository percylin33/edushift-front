import { createFormProtection } from '@shared/services/form-protection.service';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { DocumentType, EnrollmentStatus, Gender, RelationshipType } from '@core/enums';
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
import { StudentsApiService } from '../../services';
import {
  AddGuardianRequest,
  CreateStudentRequest,
  StudentDetail,
  UpdateStudentRequest,
} from '../../models';
import { StudentEnrollmentStatus } from '@core/enums';

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
        @if (guardianSaveError(); as guardianErr) {
          <div class="alert alert-danger mb-4">
            <app-icon name="alert-circle" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">El estudiante ya se registró; falta vincular al tutor.</p>
              <p class="mt-1 text-xs opacity-80">{{ guardianErr }}</p>
              <p class="mt-1 text-xs opacity-80">
                Corrige los datos del tutor y vuelve a guardar. No se creará otro estudiante.
              </p>
            </div>
          </div>
        }
        @if (errorBanner(); as err) {
          @if (!guardianSaveError()) {
            <div class="alert alert-danger mb-4">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                <p class="font-medium">No pudimos guardar los cambios.</p>
                <p class="mt-1 text-xs opacity-80">{{ err }}</p>
              </div>
            </div>
          }
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

          @if (!editing()) {
            <section class="card">
              <header class="card-header">
                <h2 class="card-title">Tutor / apoderado</h2>
                <p class="card-description">
                  Opcional. Si completas algún dato, agrega también su documento, nombres y
                  relación.
                </p>
              </header>
              <div class="card-body grid gap-4 sm:grid-cols-12">
                <div class="field sm:col-span-3">
                  <label class="label" for="guardianDocumentType">Tipo de documento</label>
                  <select
                    id="guardianDocumentType"
                    class="select"
                    formControlName="guardianDocumentType"
                  >
                    @for (opt of documentTypeOptions; track opt.value) {
                      <option [ngValue]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </div>

                <div class="field sm:col-span-9">
                  <label class="label" for="guardianDocumentNumber">Número de documento</label>
                  <input
                    id="guardianDocumentNumber"
                    type="text"
                    class="input"
                    placeholder="Ej. 12345678"
                    formControlName="guardianDocumentNumber"
                    autocomplete="off"
                  />
                  @if (showError('guardianDocumentNumber'); as err) {
                    <p class="error">{{ err }}</p>
                  }
                </div>

                <div class="field sm:col-span-6">
                  <label class="label" for="guardianFirstName">Nombres</label>
                  <input
                    id="guardianFirstName"
                    type="text"
                    class="input"
                    formControlName="guardianFirstName"
                    autocomplete="given-name"
                  />
                  @if (showError('guardianFirstName'); as err) {
                    <p class="error">{{ err }}</p>
                  }
                </div>

                <div class="field sm:col-span-3">
                  <label class="label" for="guardianLastName">Apellido paterno</label>
                  <input
                    id="guardianLastName"
                    type="text"
                    class="input"
                    formControlName="guardianLastName"
                    autocomplete="family-name"
                  />
                  @if (showError('guardianLastName'); as err) {
                    <p class="error">{{ err }}</p>
                  }
                </div>

                <div class="field sm:col-span-3">
                  <label class="label" for="guardianSecondLastName">Apellido materno</label>
                  <input
                    id="guardianSecondLastName"
                    type="text"
                    class="input"
                    formControlName="guardianSecondLastName"
                  />
                  @if (showError('guardianSecondLastName'); as err) {
                    <p class="error">{{ err }}</p>
                  }
                </div>

                <div class="field sm:col-span-4">
                  <label class="label" for="guardianEmail">Email</label>
                  <input
                    id="guardianEmail"
                    type="email"
                    class="input"
                    formControlName="guardianEmail"
                    autocomplete="email"
                  />
                  @if (showError('guardianEmail'); as err) {
                    <p class="error">{{ err }}</p>
                  }
                </div>

                <div class="field sm:col-span-4">
                  <label class="label" for="guardianPhone">Teléfono</label>
                  <input
                    id="guardianPhone"
                    type="tel"
                    class="input"
                    formControlName="guardianPhone"
                    autocomplete="tel"
                  />
                  @if (showError('guardianPhone'); as err) {
                    <p class="error">{{ err }}</p>
                  }
                </div>

                <div class="field sm:col-span-4">
                  <label class="label" for="guardianOccupation">Ocupación</label>
                  <input
                    id="guardianOccupation"
                    type="text"
                    class="input"
                    formControlName="guardianOccupation"
                  />
                  @if (showError('guardianOccupation'); as err) {
                    <p class="error">{{ err }}</p>
                  }
                </div>

                <div class="field sm:col-span-6">
                  <label class="label" for="guardianRelationship">Relación con el estudiante</label>
                  <select
                    id="guardianRelationship"
                    class="select"
                    formControlName="guardianRelationship"
                  >
                    @for (opt of relationshipOptions; track opt.value) {
                      <option [ngValue]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </div>

                <div class="grid content-end gap-2 sm:col-span-6">
                  <label class="flex items-center gap-2 text-sm text-content">
                    <input
                      type="checkbox"
                      class="checkbox"
                      formControlName="guardianIsPrimaryContact"
                    />
                    <span>Contacto principal</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm text-content">
                    <input
                      type="checkbox"
                      class="checkbox"
                      formControlName="guardianCanPickupStudent"
                    />
                    <span>Puede recoger al estudiante</span>
                  </label>
                </div>
              </div>
            </section>
          }

          <section class="card">
            <header class="card-header">
              <h2 class="card-title">Matrícula</h2>
              <p class="card-description">
                Estado institucional del estudiante. La
                <strong>fecha</strong> también actualiza la matrícula activa en sección (la que usa
                el libro de notas).
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
                <label class="label" for="enrollmentDate">Fecha de matrícula</label>
                <input
                  id="enrollmentDate"
                  type="date"
                  class="input"
                  formControlName="enrollmentDate"
                />
                <p class="field-hint">
                  Debe caer dentro del año académico de la sección (ej. desde el inicio del año).
                  Para poder calificar, también ≤ la fecha de la evaluación en el libro de notas.
                </p>
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
              [disabled]="form.invalid || submitting()"
            >
              @if (submitting()) {
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
  protected readonly formProtection = createFormProtection({
    snapshot: () => this.form.getRawValue(),
    saving: () => this.saving(),
    active: () => !this.loadingDetail(),
  });

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(StudentsStore);
  private readonly studentsApi = inject(StudentsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly academicApi = inject(AcademicApiService);
  private readonly destroyRef = inject(DestroyRef);

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
  /** Student was saved but guardian linking needs a retry. */
  private readonly createdStudentUuid = signal<string | null>(null);
  /** Original institutional date, used to avoid rewriting an unchanged section enrollment. */
  private originalEnrollmentDate: string | null = null;
  protected readonly editing = signal(false);

  protected readonly saving = this.store.saving;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly errorBanner = this.store.error;
  protected readonly guardianSaveError = signal<string | null>(null);
  protected readonly submitting = computed(() => this.saving() || this.store.savingGuardian());

  /** Per-field server-side errors keyed by control name. */
  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly title = computed(() =>
    this.editing() ? 'Editar estudiante' : 'Nuevo estudiante',
  );
  protected readonly subtitle = computed(() =>
    this.editing()
      ? 'Actualiza los datos del estudiante; los campos en blanco se mantienen.'
      : 'Completa los datos básicos para registrarlo en la institución.',
  );
  protected readonly submitLabel = computed(() =>
    this.editing()
      ? 'Guardar cambios'
      : this.createdStudentUuid()
        ? 'Reintentar vínculo del tutor'
        : 'Crear estudiante',
  );

  protected readonly relationshipOptions: ReadonlyArray<{
    value: RelationshipType;
    label: string;
  }> = [
    { value: RelationshipType.Mother, label: 'Madre' },
    { value: RelationshipType.Father, label: 'Padre' },
    { value: RelationshipType.Grandparent, label: 'Abuelo/a' },
    { value: RelationshipType.Guardian, label: 'Tutor legal' },
    { value: RelationshipType.Other, label: 'Otro' },
  ];

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
    guardianDocumentType: [DocumentType.Dni],
    guardianDocumentNumber: [''],
    guardianFirstName: ['', [Validators.maxLength(100)]],
    guardianLastName: ['', [Validators.maxLength(100)]],
    guardianSecondLastName: ['', [Validators.maxLength(100)]],
    guardianEmail: ['', [Validators.email, Validators.maxLength(254)]],
    guardianPhone: ['', [Validators.maxLength(32)]],
    guardianOccupation: ['', [Validators.maxLength(100)]],
    guardianRelationship: [RelationshipType.Mother],
    guardianIsPrimaryContact: [false],
    guardianCanPickupStudent: [false],
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

    this.syncGuardianValidators();
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncGuardianValidators());

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
        const enrollmentDateChanged =
          patch.enrollmentDate !== undefined &&
          patch.enrollmentDate !== this.originalEnrollmentDate;
        const updated = await this.store.update(id, patch);
        if (updated && enrollmentDateChanged && patch.enrollmentDate) {
          await this.syncActiveSectionEnrolledAt(id, patch.enrollmentDate);
        }
        if (updated) {
          this.formProtection.markSaved();
          await this.router.navigate([ROUTES.STUDENTS.detail(updated.publicUuid)]);
        }
      } else {
        let studentUuid = this.createdStudentUuid();
        if (!studentUuid) {
          const created = await this.store.create(this.toCreateRequest());
          if (!created) return;
          studentUuid = created.publicUuid;
          this.createdStudentUuid.set(studentUuid);
        }

        const guardianRequest = this.toGuardianRequest();
        if (guardianRequest) {
          const guardian = await this.store.addGuardian(studentUuid, guardianRequest);
          if (!guardian) {
            this.guardianSaveError.set(
              this.store.error() ?? 'No pudimos guardar los datos del tutor. Inténtalo nuevamente.',
            );
            this.lockStudentFieldsAfterCreate();
            return;
          }
        }

        /* Si el admin eligió sección, encadenamos la matrícula después
         * del alta y del tutor. Un fallo de matrícula queda informado
         * por el store; el estudiante y el tutor ya están registrados. */
        await this.maybeEnrollAfterCreate(studentUuid);
        this.formProtection.markSaved();
        await this.router.navigate([ROUTES.STUDENTS.detail(studentUuid)]);
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
    if (ctrl.errors['pattern']) {
      if (
        controlName === 'guardianDocumentNumber' &&
        this.form.get('guardianDocumentType')?.value === DocumentType.Dni
      ) {
        return 'El DNI debe tener exactamente 8 dígitos numéricos.';
      }
      return 'Solo letras, dígitos y guiones.';
    }
    return 'Valor inválido.';
  }

  protected hasGuardianData(): boolean {
    const v = this.form.getRawValue();
    return (
      [
        v.guardianDocumentNumber,
        v.guardianFirstName,
        v.guardianLastName,
        v.guardianSecondLastName,
        v.guardianEmail,
        v.guardianPhone,
        v.guardianOccupation,
      ].some((value) => typeof value === 'string' && value.trim().length > 0) ||
      !!v.guardianIsPrimaryContact ||
      !!v.guardianCanPickupStudent
    );
  }

  private syncGuardianValidators(): void {
    const hasGuardianData = this.hasGuardianData();
    const type = this.form.get('guardianDocumentType')?.value as DocumentType;
    const documentNumber = this.form.get('guardianDocumentNumber');
    if (!documentNumber) return;

    const documentValidators = [Validators.maxLength(20)];
    if (type === DocumentType.Dni) {
      documentValidators.push(Validators.pattern(/^\d{8}$/));
    } else {
      documentValidators.push(Validators.minLength(4), Validators.pattern(/^[A-Za-z0-9-]+$/));
    }
    if (hasGuardianData) documentValidators.unshift(Validators.required);
    documentNumber.setValidators(documentValidators);

    const firstName = this.form.get('guardianFirstName');
    const lastName = this.form.get('guardianLastName');
    firstName?.setValidators(
      hasGuardianData
        ? [Validators.required, Validators.maxLength(100)]
        : [Validators.maxLength(100)],
    );
    lastName?.setValidators(
      hasGuardianData
        ? [Validators.required, Validators.maxLength(100)]
        : [Validators.maxLength(100)],
    );

    documentNumber.updateValueAndValidity({ emitEvent: false });
    firstName?.updateValueAndValidity({ emitEvent: false });
    lastName?.updateValueAndValidity({ emitEvent: false });
  }

  private toGuardianRequest(): AddGuardianRequest | null {
    if (!this.hasGuardianData()) return null;
    const v = this.form.getRawValue();
    const lastName = [v.guardianLastName.trim(), this.optionalString(v.guardianSecondLastName)]
      .filter((part): part is string => !!part)
      .join(' ');
    return {
      documentType: v.guardianDocumentType,
      documentNumber: v.guardianDocumentNumber.trim(),
      firstName: v.guardianFirstName.trim(),
      lastName,
      email: this.optionalString(v.guardianEmail),
      phone: this.optionalString(v.guardianPhone),
      occupation: this.optionalString(v.guardianOccupation),
      relationship: v.guardianRelationship,
      isPrimaryContact: !!v.guardianIsPrimaryContact,
      canPickupStudent: !!v.guardianCanPickupStudent,
    };
  }

  private lockStudentFieldsAfterCreate(): void {
    [
      'documentType',
      'documentNumber',
      'firstName',
      'lastName',
      'secondLastName',
      'birthDate',
      'gender',
      'email',
      'phone',
      'address',
      'enrollmentStatus',
      'enrollmentDate',
      'sectionPublicUuid',
    ].forEach((name) => this.form.get(name)?.disable({ emitEvent: false }));
  }

  private hydrateFrom(detail: StudentDetail): void {
    this.originalEnrollmentDate = this.toDateInput(detail.enrollmentDate);
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
      enrollmentDate: this.originalEnrollmentDate,
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
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Aligns ACTIVE section enrollment {@code enrolledAt} with the
   * institutional {@code enrollmentDate} so gradebook gates stay in sync.
   */
  private async syncActiveSectionEnrolledAt(
    studentUuid: string,
    enrolledAt: string,
  ): Promise<void> {
    try {
      const rows = await firstValueFrom(this.studentsApi.listEnrollments(studentUuid));
      const active = rows.find((r) => r.active || r.status === StudentEnrollmentStatus.Active);
      if (!active) return;

      const current = active.enrolledAt ? this.toDateInput(active.enrolledAt) : null;
      if (current === enrolledAt) return;

      await firstValueFrom(this.studentsApi.updateEnrollment(active.publicUuid, { enrolledAt }));
    } catch (err) {
      this.applyServerErrors(err);
      // Student profile already saved; keep user on the form with a clear field error
      // instead of silently navigating with a stale section enrolledAt.
      if (err instanceof HttpErrorResponse) {
        const apiErr = (err.error as { errors?: ApiError[]; message?: string } | null | undefined)
          ?.errors?.[0];
        const msg =
          apiErr?.message ??
          (err.error as { message?: string } | null)?.message ??
          'No se pudo actualizar la fecha de matrícula en la sección.';
        this.fieldErrors.update((prev) => ({
          ...prev,
          enrollmentDate:
            apiErr?.code === 'ENROLLMENT_DATE_OUT_OF_YEAR' ? msg : (prev['enrollmentDate'] ?? msg),
        }));
      }
      throw err;
    }
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
        next['documentNumber'] = 'Ya existe un estudiante con este documento en la institución.';
        break;
      case 'STUDENT_EMAIL_TAKEN':
        next['email'] = 'Ya existe un estudiante con este email.';
        break;
      case 'ENROLLMENT_DATE_OUT_OF_YEAR':
        next['enrollmentDate'] = 'La fecha está fuera del año académico de la sección activa.';
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
   * {@link StudentsStore#enrollStudent} usando la fecha indicada en la ficha y el
   * año académico activo. Mantenemos la llamada aislada del
   * {@code create} para que un fallo aquí no rompa la UX general:
   * el estudiante queda creado y el banner del store muestra el
   * error de matrícula.
   */
  private async maybeEnrollAfterCreate(studentPublicUuid: string): Promise<void> {
    const sectionUuid = this.form.getRawValue().sectionPublicUuid;
    const year = this.activeYear();
    if (!sectionUuid || !year) return;

    /* Conserva la fecha institucional indicada en la ficha. Si queda vacía,
     * usa hoy dentro del año activo o el inicio del año si hoy queda fuera. */
    const requestedDate = this.form.getRawValue().enrollmentDate;
    const today = this.toDateInput(new Date()) ?? '';
    const minDate = this.toDateInput(year.startDate) ?? '';
    const maxDate = this.toDateInput(year.endDate) ?? '';
    const enrolledAt = requestedDate || (today >= minDate && today <= maxDate ? today : minDate);

    await this.store.enrollStudent(studentPublicUuid, {
      sectionPublicUuid: sectionUuid,
      academicYearPublicUuid: year.publicUuid,
      enrolledAt,
    });
  }
}

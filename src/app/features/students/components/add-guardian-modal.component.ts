import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { DocumentType, RelationshipType } from '@core/enums';
import { ApiError } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { StudentsStore } from '../store/students.store';
import { AddGuardianRequest } from '../models';

/**
 * Modal for {@code POST /v1/students/{publicUuid}/guardians}.
 *
 * <h3>Why this is one form, not two</h3>
 * The backend's "find or create" semantics keep the UX flat: admins
 * always type the document, name, and relationship — if the guardian
 * exists already (sibling shared elsewhere), the backend reuses it
 * silently. We don't ask the admin to disambiguate up front because
 * that would force them to know which siblings exist, and the
 * search-by-document footprint isn't on Sprint 3.
 *
 * <h3>Validation</h3>
 * Mirrors the backend's {@code @Pattern} / {@code @Size} constraints
 * and surfaces server-side codes ({@code GUARDIAN_ALREADY_LINKED})
 * inline.
 */
@Component({
  selector: 'app-add-guardian-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconComponent,
    SpinnerComponent
  ],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-guardian-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-2xl shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="add-guardian-title" class="card-title">Vincular tutor</h2>
            <p class="card-description">
              Si el documento ya existe en otro estudiante, reutilizamos al tutor.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            aria-label="Cerrar"
            (click)="close()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        @if (errorBanner(); as err) {
          <div class="alert alert-danger mx-5 mt-4">
            <app-icon name="alert-circle" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">No pudimos vincular al tutor.</p>
              <p class="mt-1 text-xs opacity-80">{{ err }}</p>
            </div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card-body grid gap-5">
          <fieldset class="grid gap-4 sm:grid-cols-12">
            <legend class="sr-only">Identidad</legend>

            <div class="field sm:col-span-3">
              <label class="label" for="g-documentType">Tipo *</label>
              <select id="g-documentType" class="select" formControlName="documentType">
                @for (opt of documentTypeOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <div class="field sm:col-span-9">
              <label class="label" for="g-documentNumber">Número de documento *</label>
              <input
                id="g-documentNumber"
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
              <label class="label" for="g-firstName">Nombres *</label>
              <input
                id="g-firstName"
                type="text"
                class="input"
                formControlName="firstName"
                autocomplete="off"
              />
              @if (showError('firstName'); as err) {
                <p class="error">{{ err }}</p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="g-lastName">Apellidos *</label>
              <input
                id="g-lastName"
                type="text"
                class="input"
                formControlName="lastName"
                autocomplete="off"
              />
              @if (showError('lastName'); as err) {
                <p class="error">{{ err }}</p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="g-email">Email</label>
              <input
                id="g-email"
                type="email"
                class="input"
                formControlName="email"
                autocomplete="off"
              />
              @if (showError('email'); as err) {
                <p class="error">{{ err }}</p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="g-phone">Teléfono</label>
              <input
                id="g-phone"
                type="tel"
                class="input"
                formControlName="phone"
                autocomplete="off"
              />
              @if (showError('phone'); as err) {
                <p class="error">{{ err }}</p>
              }
            </div>

            <div class="field sm:col-span-12">
              <label class="label" for="g-occupation">Ocupación</label>
              <input
                id="g-occupation"
                type="text"
                class="input"
                formControlName="occupation"
              />
              @if (showError('occupation'); as err) {
                <p class="error">{{ err }}</p>
              }
            </div>
          </fieldset>

          <fieldset class="grid gap-4 sm:grid-cols-12 border-t border-border-subtle pt-4">
            <legend class="sr-only">Relación</legend>

            <div class="field sm:col-span-6">
              <label class="label" for="g-relationship">Relación *</label>
              <select id="g-relationship" class="select" formControlName="relationship">
                @for (opt of relationshipOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <div class="sm:col-span-6 grid content-end gap-2">
              <label class="flex items-center gap-2 text-sm text-content">
                <input type="checkbox" class="checkbox" formControlName="isPrimaryContact" />
                <span>Contacto principal</span>
              </label>
              <label class="flex items-center gap-2 text-sm text-content">
                <input type="checkbox" class="checkbox" formControlName="canPickupStudent" />
                <span>Puede recoger al estudiante</span>
              </label>
            </div>
          </fieldset>

          <footer class="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
            <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || saving()"
            >
              @if (saving()) {
                <app-spinner [size]="14" label="Guardando" />
                <span>Guardando…</span>
              } @else {
                <app-icon name="check" [size]="16" />
                <span>Vincular tutor</span>
              }
            </button>
          </footer>
        </form>
      </div>
    </div>
  `
})
export class AddGuardianModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(StudentsStore);

  readonly studentPublicUuid = input.required<string>();
  readonly closed = output<void>();

  protected readonly saving = this.store.savingGuardian;
  protected readonly errorBanner = this.store.error;

  /** Per-field server errors keyed by control name. */
  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly documentTypeOptions: ReadonlyArray<{ value: DocumentType; label: string }> = [
    { value: DocumentType.Dni,      label: 'DNI' },
    { value: DocumentType.Ce,       label: 'CE' },
    { value: DocumentType.Passport, label: 'Pasaporte' },
    { value: DocumentType.Other,    label: 'Otro' }
  ];

  protected readonly relationshipOptions: ReadonlyArray<{
    value: RelationshipType;
    label: string;
  }> = [
    { value: RelationshipType.Mother,      label: 'Madre' },
    { value: RelationshipType.Father,      label: 'Padre' },
    { value: RelationshipType.Grandparent, label: 'Abuelo/a' },
    { value: RelationshipType.Guardian,    label: 'Tutor legal' },
    { value: RelationshipType.Other,       label: 'Otro' }
  ];

  protected readonly form: FormGroup = this.fb.group({
    documentType: [DocumentType.Dni, [Validators.required]],
    documentNumber: [
      '',
      [
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(20),
        Validators.pattern(/^[A-Za-z0-9-]+$/)
      ]
    ],
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.maxLength(32)]],
    occupation: ['', [Validators.maxLength(100)]],
    relationship: [RelationshipType.Mother, [Validators.required]],
    isPrimaryContact: [false],
    canPickupStudent: [false]
  });

  /**
   * Lazy-derived disabled state for the submit button. Lets the
   * template branch on a single signal without retyping the rule
   * inline (and inadvertently de-syncing it from the form state).
   */
  protected readonly canSubmit = computed(
    () => this.form.valid && !this.saving()
  );

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onBackdropClick(_event: MouseEvent): void {
    this.close();
  }

  protected close(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.studentPublicUuid();
    const v = this.form.getRawValue();
    const request: AddGuardianRequest = {
      documentType: v.documentType,
      documentNumber: v.documentNumber.trim(),
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: this.optionalString(v.email),
      phone: this.optionalString(v.phone),
      occupation: this.optionalString(v.occupation),
      relationship: v.relationship,
      isPrimaryContact: !!v.isPrimaryContact,
      canPickupStudent: !!v.canPickupStudent
    };

    try {
      const created = await this.store.addGuardian(id, request);
      if (created) {
        this.closed.emit();
      }
    }
    catch (err) {
      this.applyServerErrors(err);
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

  private optionalString(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    if (apiErr.code === 'GUARDIAN_ALREADY_LINKED') {
      next['documentNumber'] = 'Este tutor ya está vinculado al estudiante.';
    }
    this.fieldErrors.set(next);
  }
}

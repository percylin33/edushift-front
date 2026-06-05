import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { RelationshipType } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { StudentsStore } from '../store/students.store';
import { Guardian, UpdateGuardianLinkRequest } from '../models';

/**
 * Modal for {@code PUT /v1/students/{studentUuid}/guardians/{guardianUuid}}.
 *
 * <h3>Scope</h3>
 * Only the link metadata: {@code relationship},
 * {@code isPrimaryContact}, {@code canPickupStudent}. Editing the
 * guardian's name / email / phone needs a guardians module
 * (Sprint 4+) — until then, removing and re-linking is the workaround
 * we accept.
 *
 * <h3>Diff-aware submit</h3>
 * Only forwards changed fields so the backend can keep treating
 * {@code null} as "no change". If the form ends up identical to the
 * original record, we just close the modal — saves a round-trip and
 * avoids a noisy 422 if the backend tightens the empty-payload check.
 */
@Component({
  selector: 'app-edit-guardian-link-modal',
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
      aria-labelledby="edit-guardian-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-md shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="edit-guardian-title" class="card-title">Editar vínculo</h2>
            <p class="card-description">{{ guardian().fullName }}</p>
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
              <p class="font-medium">No pudimos actualizar el vínculo.</p>
              <p class="mt-1 text-xs opacity-80">{{ err }}</p>
            </div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card-body grid gap-4">
          <div class="field">
            <label class="label" for="el-relationship">Relación *</label>
            <select id="el-relationship" class="select" formControlName="relationship">
              @for (opt of relationshipOptions; track opt.value) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>

          <label class="flex items-center gap-2 text-sm text-content">
            <input type="checkbox" class="checkbox" formControlName="isPrimaryContact" />
            <span>Contacto principal</span>
          </label>

          <label class="flex items-center gap-2 text-sm text-content">
            <input type="checkbox" class="checkbox" formControlName="canPickupStudent" />
            <span>Puede recoger al estudiante</span>
          </label>

          <footer class="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
            <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="!canSubmit()"
            >
              @if (saving()) {
                <app-spinner [size]="14" label="Guardando" />
                <span>Guardando…</span>
              } @else {
                <app-icon name="check" [size]="16" />
                <span>Guardar cambios</span>
              }
            </button>
          </footer>
        </form>
      </div>
    </div>
  `
})
export class EditGuardianLinkModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(StudentsStore);

  readonly studentPublicUuid = input.required<string>();
  readonly guardian = input.required<Guardian>();
  readonly closed = output<void>();

  protected readonly saving = this.store.savingGuardian;
  protected readonly errorBanner = this.store.error;

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
    relationship: [RelationshipType.Mother, [Validators.required]],
    isPrimaryContact: [false],
    canPickupStudent: [false]
  });

  /**
   * Hydrate the form whenever the input changes. Using
   * {@link effect} rather than {@code ngOnInit} so the modal reacts
   * even if the parent re-uses the same component instance for a
   * different guardian (defensive — Sprint 3 always destroys and
   * re-creates, but we don't want a future refactor to silently
   * leak stale state).
   */
  constructor() {
    effect(() => {
      const g = this.guardian();
      this.form.patchValue(
        {
          relationship: g.relationship,
          isPrimaryContact: g.isPrimaryContact,
          canPickupStudent: g.canPickupStudent
        },
        { emitEvent: false }
      );
    });
  }

  protected readonly canSubmit = computed(() => this.form.valid && !this.saving());

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

    const original = this.guardian();
    const v = this.form.getRawValue();

    /* Diff: only forward fields the admin actually changed. The
     * backend treats {@code undefined} as "no change", which keeps
     * the audit log signal-to-noise high. */
    const patch: UpdateGuardianLinkRequest = {};
    if (v.relationship !== original.relationship) patch.relationship = v.relationship;
    if (!!v.isPrimaryContact !== original.isPrimaryContact) {
      patch.isPrimaryContact = !!v.isPrimaryContact;
    }
    if (!!v.canPickupStudent !== original.canPickupStudent) {
      patch.canPickupStudent = !!v.canPickupStudent;
    }

    if (Object.keys(patch).length === 0) {
      this.close();
      return;
    }

    try {
      const updated = await this.store.updateGuardianLink(
        this.studentPublicUuid(),
        original.guardianPublicUuid,
        patch
      );
      if (updated) {
        this.closed.emit();
      }
    }
    catch (err) {
      /* Errors land on the store's banner; nothing additional to
       * surface here. The catch keeps the modal open so the admin
       * can see the alert and try again. */
      void err;
    }
  }
}

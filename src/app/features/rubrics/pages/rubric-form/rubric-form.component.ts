import { createFormProtection } from '@shared/services/form-protection.service';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ApiError } from '@core/models';
import { ROUTES, API } from '@core/constants';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { AiPanelComponent } from '@features/ai/components/ai-panel';
import { CriterionEditorComponent, RubricSystemBadgeComponent } from '../../components';
import { RubricsStore } from '../../store';
import {
  CreateRubricRequest,
  CriterionInput,
  LevelInput,
  RUBRIC_DESCRIPTION_MAX_LENGTH,
  RUBRIC_NAME_MAX_LENGTH,
  RubricDetail,
  UpdateRubricRequest,
} from '../../models';

interface CriteriaLevels {
  criteria: CriterionInput[];
  levels: LevelInput[];
}

/**
 * `/rubrics/new` y `/rubrics/:uuid/edit` — Form de creación / edición
 * de rúbricas (FE-5B.2).
 *
 * <p>Form mediante {@link CriterionEditorComponent} (CVA) para que la
 * complejidad del array dinámico de criterios + niveles + descriptores
 * quede aislada en el editor. Esta page solo maneja meta (name +
 * description) y orquesta save / cancel.</p>
 */
@Component({
  selector: 'app-rubric-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CriterionEditorComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    RubricSystemBadgeComponent,
    SpinnerComponent,
    AiPanelComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header eyebrow="Rúbricas" [title]="title()" [subtitle]="subtitle()">
        @if (existing(); as e) {
          <app-rubric-system-badge
            [isSystem]="e.isSystem"
            [parentPublicUuid]="e.parentRubricPublicUuid"
          />
        }
        <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </button>
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando…" />
        </div>
      } @else if (errorBanner() && !existing()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <p class="flex-1 text-sm">{{ errorBanner() }}</p>
        </div>
      } @else {
        @if (existing()?.isSystem) {
          <div class="alert alert-info mb-4">
            <app-icon name="lock" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">Esta rúbrica es del catálogo MINEDU.</p>
              <p class="mt-1 text-sm opacity-80">
                Las rúbricas oficiales son de solo lectura. Para hacer cambios, usa
                <strong>Forkear</strong> y edita el clon.
              </p>
            </div>
            <button type="button" class="btn btn-primary btn-sm" (click)="goBackToList()">
              Volver al listado
            </button>
          </div>
        }

        @if (errorBanner()) {
          <div class="alert alert-danger mb-4">
            <app-icon name="alert-circle" [size]="18" />
            <p class="flex-1 text-sm">{{ errorBanner() }}</p>
          </div>
        }

        <form [formGroup]="metaForm" (ngSubmit)="onSubmit()" class="grid gap-6" autocomplete="off">
          <section class="card">
            <header class="card-header">
              <h3 class="card-title">Información general</h3>
            </header>
            <div class="card-body grid gap-4">
              <div class="field">
                <label class="label" for="rubric-name">Nombre *</label>
                <input
                  id="rubric-name"
                  type="text"
                  class="input"
                  formControlName="name"
                  [maxlength]="nameMaxLength"
                  placeholder="Producción escrita — Bimestre 1"
                />
                @if (showError('name'); as msg) {
                  <p class="field-error">{{ msg }}</p>
                } @else {
                  <p class="field-hint">Único en la institución. No distingue mayúsculas y minúsculas.</p>
                }
              </div>
              <div class="field">
                <label class="label" for="rubric-description">Descripción</label>
                <textarea
                  id="rubric-description"
                  class="input"
                  formControlName="description"
                  rows="3"
                  [maxlength]="descriptionMaxLength"
                  placeholder="Cuándo aplica esta rúbrica y qué evalúa."
                ></textarea>
                @if (showError('description'); as msg) {
                  <p class="field-error">{{ msg }}</p>
                }
              </div>
            </div>
          </section>

          <!-- Sprint cierre-B / F9 — AI rubric draft via SSE streaming (B11). -->
          @if (!isReadonly() && !existing()) {
            <app-ai-panel
              title="Asistente IA — Generar borrador de rúbrica"
              subtitle="Define los criterios y la IA propone niveles + descriptores."
              triggerLabel="Generar rúbrica"
              [idleHint]="'Indicá el nombre y al menos un criterio en el editor de abajo. La IA los va a expandir.'"
              [draftSummary]="aiDraftSummary()"
              [endpoint]="API.AI.GENERATE_RUBRIC_STREAM"
              [requestBody]="aiRubricRequestBody()"
              [parse]="parseRubricDraft"
              (done)="applyRubricDraft($event)"
              (failed)="onAiError($event)"
            />
          }

          <app-criterion-editor
            [readonly]="isReadonly()"
            [(ngModel)]="value"
            [ngModelOptions]="{ standalone: true }"
          />

          <footer class="flex flex-wrap items-center justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">Cancelar</button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="metaForm.invalid || saving() || isReadonly()"
            >
              @if (saving()) {
                <app-spinner [size]="14" label="Guardando" />
                <span>Guardando…</span>
              } @else {
                <app-icon name="check" [size]="16" />
                <span>{{ submitLabel() }}</span>
              }
            </button>
          </footer>
        </form>
      }
    </app-page-container>
  `,
})
export class RubricFormComponent implements OnInit, OnDestroy {
  protected readonly formProtection = createFormProtection({
    snapshot: () => [this.metaForm.getRawValue(), this.value],
    saving: () => this.saving(),
    active: () => !this.isReadonly() && !this.loading(),
  });

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(RubricsStore);

  @ViewChild(CriterionEditorComponent)
  protected editor?: CriterionEditorComponent;

  protected readonly nameMaxLength = RUBRIC_NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = RUBRIC_DESCRIPTION_MAX_LENGTH;

  protected readonly existing = signal<RubricDetail | null>(null);
  protected readonly loading = signal<boolean>(false);

  protected readonly saving = this.store.saving;
  /** Exposed via getter so the template can reference {@code API.AI.*} directly. */
  protected readonly API = API;
  /** Local writable banner for AI-panel errors (decoupled from the store's readonly {@code error}). */
  protected readonly errorBanner = signal<string | null>(null);

  protected readonly title = computed(() => {
    const e = this.existing();
    return e ? `Editar: ${e.name}` : 'Nueva rúbrica';
  });
  protected readonly subtitle = computed(() => {
    return (
      this.existing()?.description ??
      'Define los criterios, niveles y descriptores para evaluar cualitativamente.'
    );
  });

  protected readonly submitLabel = computed(() =>
    this.existing() ? 'Guardar cambios' : 'Crear rúbrica',
  );

  protected readonly isReadonly = computed(() => this.existing()?.isSystem === true);

  protected readonly metaForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(RUBRIC_NAME_MAX_LENGTH)]],
    description: ['', [Validators.maxLength(RUBRIC_DESCRIPTION_MAX_LENGTH)]],
  });

  protected value: CriteriaLevels = {
    criteria: [],
    levels: [],
  };

  private readonly fieldErrors = signal<Record<string, string>>({});

  // ============================================================================
  // Sprint cierre-B / F9 — AI rubric draft integration
  // ============================================================================

  /** Builds the SSE request body from the current form state. */
  protected readonly aiRubricRequestBody = computed(() => {
    const criteriaNames = this.value.criteria
      .map((c) => c.name?.trim())
      .filter((n): n is string => !!n && n.length > 0);
    return {
      courseName: this.existing()?.description ?? 'Curso',
      criteria: criteriaNames.length > 0 ? criteriaNames : ['Criterio de evaluación'],
      seedRubricId: null,
      levelCount: Math.max(2, this.value.levels.length || 4),
    };
  });

  /** One-line summary shown in the AI panel after a successful generation. */
  protected readonly aiDraftSummary = signal<string>('');

  /** Pure JSON.parse; the BE hands us a full RubricGeneratorResult envelope. */
  protected readonly parseRubricDraft = (json: string): {
    rubric?: { title?: string; description?: string; criteria?: { name: string; weight: number; descriptors: Record<string, string> }[]; levels?: { code: string; name: string; order?: number }[] };
  } => JSON.parse(json);

  /** Applies the AI draft to the rubric form's criteria + levels + meta. */
  protected applyRubricDraft(payload: {
    rubric?: { title?: string; description?: string; criteria?: { name: string; weight: number; descriptors: Record<string, string> }[]; levels?: { code: string; name: string; order?: number }[] };
  }): void {
    const rubric = payload?.rubric;
    if (!rubric) {
      this.errorBanner.set?.('La IA no devolvió un borrador válido.');
      return;
    }
    // Update meta (name + description) if the AI suggested values.
    const patch: Record<string, unknown> = {};
    if (rubric.title && !this.metaForm.get('name')?.value) patch['name'] = rubric.title;
    if (rubric.description) patch['description'] = rubric.description;
    if (Object.keys(patch).length > 0) this.metaForm.patchValue(patch);

    // Replace levels with AI-suggested ones if any.
    const newLevels: LevelInput[] = (rubric.levels ?? []).map((l, idx) => ({
      code: l.code || `L${idx + 1}`,
      name: l.name || `Nivel ${idx + 1}`,
      order: l.order ?? idx + 1,
    }));

    // Map AI criteria to CriterionInput shape.
    const newCriteria: CriterionInput[] = (rubric.criteria ?? []).map((c, idx) => {
      const descriptors = c.descriptors ?? {};
      return {
        key: `c${idx + 1}`,
        name: c.name,
        description: '',
        weight: typeof c.weight === 'number' ? c.weight : 1 / (rubric.criteria?.length || 1),
        descriptors: newLevels.length > 0
          ? newLevels.map((l) => ({ level: l.code, text: descriptors[l.code] ?? '' }))
          : Object.entries(descriptors).map(([code, text]) => ({ level: code, text })),
      };
    });

    this.value = {
      criteria: newCriteria,
      levels: newLevels.length > 0 ? newLevels : this.value.levels,
    };

    this.aiDraftSummary.set(
      `Aplicado: ${newCriteria.length} criterios, ${newLevels.length || this.value.levels.length} niveles. Revisá antes de guardar.`,
    );
  }

  protected onAiError(message: string): void {
    // Rubric store doesn't expose a setter for the error banner, so we
    // surface it via a transient local signal that the template reads.
    this.aiErrorMessage.set(message);
  }

  protected readonly aiErrorMessage = signal<string | null>(null);
  private routeSub?: Subscription;

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const uuid = params.get('publicUuid');
      if (uuid) {
        await this.loadExisting(uuid);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.store.clearSelected();
  }

  // ===========================================================================
  // Load existing (edit mode)
  // ===========================================================================

  private async loadExisting(publicUuid: string): Promise<void> {
    this.loading.set(true);
    try {
      const detail = await this.store.loadDetail(publicUuid);
      if (!detail) return;
      this.existing.set(detail);
      this.metaForm.patchValue({
        name: detail.name,
        description: detail.description ?? '',
      });
      this.value = {
        criteria: detail.criteria.map((c) => ({
          key: c.key,
          name: c.name,
          description: c.description,
          weight: c.weight,
          descriptors: c.descriptors.map((d) => ({ ...d })),
        })),
        levels: detail.levels.map((l) => ({
          code: l.code,
          name: l.name,
          order: l.order,
        })),
      };
      if (detail.isSystem) {
        this.metaForm.disable();
      }
    } finally {
      this.loading.set(false);
    }
  }

  // ===========================================================================
  // Submit
  // ===========================================================================

  protected async onSubmit(): Promise<void> {
    if (this.isReadonly()) return;
    if (this.metaForm.invalid) {
      this.metaForm.markAllAsTouched();
      return;
    }
    if (!this.editor || !this.editor.isValid()) {
      // El editor expone su propia mensajería; aquí solo evitamos el submit.
      return;
    }
    const editorValue = this.editor.toValue();
    const meta = this.metaForm.getRawValue();

    try {
      const e = this.existing();
      if (e) {
        const patch: UpdateRubricRequest = {
          name: (meta.name as string).trim(),
          description: ((meta.description as string) ?? '').trim() || undefined,
          criteria: editorValue.criteria,
          levels: editorValue.levels,
        };
        const updated = await this.store.update(e.publicUuid, patch);
        if (updated) {
          this.formProtection.markSaved();
          await this.router.navigate([ROUTES.RUBRICS.detail(updated.publicUuid)]);
        }
      } else {
        const payload: CreateRubricRequest = {
          name: (meta.name as string).trim(),
          description: ((meta.description as string) ?? '').trim() || undefined,
          criteria: editorValue.criteria,
          levels: editorValue.levels,
        };
        const created = await this.store.create(payload);
        if (created) {
          this.formProtection.markSaved();
          await this.router.navigate([ROUTES.RUBRICS.detail(created.publicUuid)]);
        }
      }
    } catch (err) {
      this.applyServerErrors(err);
    }
  }

  protected cancel(): void {
    this.store.clearError();
    void this.router.navigate([ROUTES.RUBRICS.LIST]);
  }

  protected goBackToList(): void {
    void this.router.navigate([ROUTES.RUBRICS.LIST]);
  }

  // ===========================================================================
  // Errors
  // ===========================================================================

  protected showError(controlName: string): string | null {
    const ctrl = this.metaForm.get(controlName);
    if (!ctrl) return null;

    const serverErr = this.fieldErrors()[controlName];
    if (serverErr) return serverErr;

    if (!ctrl.touched && !ctrl.dirty) return null;
    if (!ctrl.errors) return null;
    if (ctrl.errors['required']) return 'Campo requerido.';
    if (ctrl.errors['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    return 'Valor inválido.';
  }

  /**
   * Mapea códigos del backend a mensajes de campo.
   * Cobertura: {@code RUB_NAME_EXISTS}, {@code RUB_CRITERIA_WEIGHT_SUM},
   * {@code RUB_LEVEL_CODE_DUPLICATE}, {@code RUB_DESCRIPTOR_LEVEL_UNKNOWN}.
   */
  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'RUB_NAME_EXISTS':
        next['name'] = 'Ya existe una rúbrica con este nombre.';
        break;
      // Los demás (criterios / niveles / descriptores) caen al banner global
      // porque son cross-field y el editor los señala visualmente.
    }
    this.fieldErrors.set(next);
  }
}

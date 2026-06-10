import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import {
  EVALUATION_SCALE_LABELS,
  EvaluationDetail,
  EvaluationScale,
  EvaluationStatus
} from '@features/evaluations/models';
import { EvaluationsApiService } from '@features/evaluations/services';
import { EvaluationStatusBadgeComponent } from '@features/evaluations/components/evaluation-status-badge.component';
import {
  GradeRecordFormModalComponent,
  GradeRecordsBulkModalComponent
} from '../../components';
import {
  ALLOWED_LITERALS_BY_SCALE,
  CreateGradeRecordRequest,
  GradeRecordRow,
  SCORE_MAX,
  SCORE_MIN,
  areGradesEditable,
  validateGradeShape
} from '../../models';
import { GradeRecordsStore } from '../../store';

interface InlineEditState {
  publicUuid: string;
  field: 'score' | 'literal' | 'comments';
  value: string;
  error: string | null;
}

type InlineEditOutcome =
  | { kind: 'error'; message: string }
  | { kind: 'unchanged' }
  | {
      kind: 'patch';
      payload: {
        score?: number | null;
        literal?: string | null;
        comments?: string | null;
      };
    };

/**
 * `/evaluations/:publicUuid/grades` — Pantalla de registro de
 * calificaciones para una evaluation concreta (FE-5B.3).
 *
 * <h3>Funcionalidad MVP</h3>
 * <ul>
 *   <li>Header con metadata de la evaluation (nombre, scale, status,
 *       conteo) + botón "Volver" al detail y "Bulk CSV".</li>
 *   <li>Tabla con columnas: estudiante, valor (score o literal), comentarios,
 *       fecha de registro, acciones (editar / borrar).</li>
 *   <li><b>Inline edit</b>: doble-click en una celda <code>score</code> /
 *       <code>literal</code> / <code>comments</code> abre un input
 *       inline. Enter guarda, Escape cancela. Validación cliente espeja la
 *       matriz per-scale del backend.</li>
 *   <li>Modal de "Registrar nota" para crear (upsert por UUID) y "Editar"
 *       cuando el inline no alcanza (e.g. quiero cambiar literal y comments
 *       a la vez).</li>
 *   <li>Modal de bulk CSV con preview por fila + atomic submit (BE-5B.3
 *       rechaza el batch entero si una fila es inválida).</li>
 *   <li>Read-only banner cuando la evaluation está <code>CLOSED</code>.
 *       El servidor responde con <code>409 GRADE_EVAL_CLOSED</code> si se
 *       intenta — aquí lo evitamos disable-side.</li>
 * </ul>
 *
 * <h3>Deuda técnica documentada</h3>
 * <p>El roster de la sección no está expuesto a {@code TEACHER}, por lo
 * que esta pantalla muestra solo estudiantes con nota registrada. Para
 * agregar nuevas notas hace falta el {@code studentPublicUuid} (modal o
 * CSV). Se trackea como deuda <strong>DEBT-FE-EVAL-1</strong> a
 * resolver en sprint posterior con un endpoint
 * {@code GET /v1/academic/sections/{uuid}/students-light} con RBAC
 * {@code TENANT_ADMIN | TEACHER}.</p>
 */
@Component({
  selector: 'app-grade-records-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    EvaluationStatusBadgeComponent,
    FormsModule,
    GradeRecordFormModalComponent,
    GradeRecordsBulkModalComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Calificaciones"
        [title]="title()"
        [subtitle]="subtitle()"
      >
        <button type="button" class="btn btn-ghost btn-sm" (click)="goBack()">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </button>
        @if (canEdit()) {
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="saving()"
            (click)="openBulk()"
          >
            <app-icon name="upload" [size]="16" />
            <span>Bulk CSV</span>
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="saving()"
            (click)="openCreate()"
          >
            <app-icon name="plus" [size]="16" />
            <span>Registrar nota</span>
          </button>
        }
      </app-page-header>

      @if (evaluation(); as e) {
        <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <app-evaluation-status-badge [status]="e.status" />
          <span class="text-content-muted">
            {{ scaleLabel(e.scale) }}
          </span>
          <span class="text-content-muted">·</span>
          <span class="text-content-muted">
            {{ counts().total }} registrada(s)
          </span>
        </div>

        @if (!canEdit()) {
          <div class="alert alert-warning mb-4">
            <app-icon name="lock" [size]="16" />
            <p class="flex-1 text-sm">
              Esta evaluación está
              <strong>{{ statusLabel(e.status) }}</strong>: no se pueden
              registrar, editar ni borrar notas. Para reabrir, contacta al
              administrador.
            </p>
          </div>
        }
      }

      @if (lastBulk(); as b) {
        <div class="alert alert-success mb-4">
          <app-icon name="check" [size]="16" />
          <p class="flex-1 text-sm">
            Bulk procesado: <strong>{{ b.created }}</strong> creadas ·
            <strong>{{ b.updated }}</strong> actualizadas ·
            <strong>{{ b.requested }}</strong> enviadas.
          </p>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            (click)="dismissBulk()"
          >
            Ocultar
          </button>
        </div>
      }

      @if (errorBanner() && rows().length > 0) {
        <div class="alert alert-danger mb-4">
          <app-icon name="alert-circle" [size]="16" />
          <p class="flex-1 text-sm">{{ errorBanner() }}</p>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            (click)="clearError()"
          >
            Cerrar
          </button>
        </div>
      }

      <section class="card overflow-hidden">
        @if (loading()) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando notas…" />
          </div>
        } @else if (errorBanner() && rows().length === 0) {
          <div class="alert alert-danger m-5">
            <app-icon name="alert-circle" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">No pudimos cargar las notas.</p>
              <p class="mt-1 text-xs opacity-80">{{ errorBanner() }}</p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="reload()"
            >
              Reintentar
            </button>
          </div>
        } @else if (rows().length === 0) {
          <app-empty-state
            icon="target"
            title="Sin notas registradas"
            description="Aún no hay calificaciones para esta evaluación. Registra la primera o usa Bulk CSV para varias a la vez."
          >
            @if (canEdit()) {
              <button
                type="button"
                class="btn btn-primary btn-sm"
                (click)="openCreate()"
              >
                <app-icon name="plus" [size]="16" />
                <span>Registrar nota</span>
              </button>
            }
          </app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th class="w-32">{{ valueColumn() }}</th>
                  <th>Comentarios</th>
                  <th class="w-36">Registrado</th>
                  <th class="text-right w-32">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.publicUuid) {
                  <tr [class.opacity-60]="!row.isActive">
                    <td>
                      <p class="font-medium">{{ row.studentFullName }}</p>
                      <p class="text-xs text-content-muted font-mono">
                        {{ shorten(row.studentPublicUuid) }}
                      </p>
                    </td>

                    <!-- VALUE CELL -->
                    @if (isEditing(row.publicUuid, 'score') || isEditing(row.publicUuid, 'literal')) {
                      <td>
                        @if (scale() === scaleScore) {
                          <input
                            #valueInput
                            type="number"
                            step="0.01"
                            [min]="scoreMin"
                            [max]="scoreMax"
                            class="input input-sm w-24"
                            [value]="editState()!.value"
                            (input)="onEditChange($any($event.target).value)"
                            (keydown.enter)="saveEdit(row)"
                            (keydown.escape)="cancelEdit()"
                            (blur)="saveEdit(row)"
                            autofocus
                          />
                        } @else {
                          <select
                            class="input input-sm w-24"
                            [value]="editState()!.value"
                            (change)="onEditChange($any($event.target).value)"
                            (blur)="saveEdit(row)"
                          >
                            <option value="">—</option>
                            @for (l of allowedLiterals(); track l) {
                              <option [value]="l">{{ l }}</option>
                            }
                          </select>
                        }
                        @if (editState()?.error) {
                          <p class="text-xs text-danger-700 mt-1">
                            {{ editState()!.error }}
                          </p>
                        }
                      </td>
                    } @else {
                      <td
                        [class.cursor-pointer]="canEdit()"
                        (dblclick)="startEditValue(row)"
                        [title]="canEdit() ? 'Doble click para editar' : ''"
                      >
                        @if (busyRow(row.publicUuid)) {
                          <app-spinner [size]="14" />
                        } @else if (scale() === scaleScore) {
                          <span class="font-mono tabular-nums">
                            {{ row.score !== null ? (row.score | number: '1.0-2') : '—' }}
                          </span>
                        } @else {
                          <span class="badge badge-neutral font-mono">
                            {{ row.literal || '—' }}
                          </span>
                        }
                      </td>
                    }

                    <!-- COMMENTS CELL -->
                    @if (isEditing(row.publicUuid, 'comments')) {
                      <td>
                        <input
                          type="text"
                          class="input input-sm w-full"
                          [value]="editState()!.value"
                          [attr.maxlength]="commentsMaxLength"
                          (input)="onEditChange($any($event.target).value)"
                          (keydown.enter)="saveEdit(row)"
                          (keydown.escape)="cancelEdit()"
                          (blur)="saveEdit(row)"
                          autofocus
                        />
                      </td>
                    } @else {
                      <td
                        class="max-w-md"
                        [class.cursor-pointer]="canEdit()"
                        (dblclick)="startEditComments(row)"
                        [title]="canEdit() ? 'Doble click para editar' : ''"
                      >
                        <span class="text-xs text-content-muted line-clamp-2">
                          {{ row.comments || '—' }}
                        </span>
                      </td>
                    }

                    <td class="text-xs text-content-muted">
                      {{ formatRecorded(row.recordedAt) }}
                    </td>
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        @if (canEdit()) {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs"
                            title="Editar todo"
                            [disabled]="busyRow(row.publicUuid)"
                            (click)="openEdit(row)"
                          >
                            <app-icon name="pencil" [size]="14" />
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50"
                            title="Borrar"
                            [disabled]="busyRow(row.publicUuid)"
                            (click)="onDelete(row)"
                          >
                            <app-icon name="x" [size]="14" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </app-page-container>

    @if (showCreate() && evaluation(); as e) {
      <app-grade-record-form-modal
        [scale]="e.scale"
        [saving]="saving()"
        [errorBanner]="errorBanner()"
        (closed)="closeCreate()"
        (submitted)="onCreate($event)"
      />
    }

    @if (editing(); as r) {
      @if (evaluation(); as e) {
        <app-grade-record-form-modal
          [scale]="e.scale"
          [row]="r"
          [saving]="saving()"
          [errorBanner]="errorBanner()"
          (closed)="closeEdit()"
          (submitted)="onUpdateFromModal(r, $event)"
        />
      }
    }

    @if (showBulk() && evaluation(); as e) {
      <app-grade-records-bulk-modal
        [scale]="e.scale"
        [saving]="saving()"
        [errorBanner]="errorBanner()"
        [lastSummary]="lastBulk()"
        (closed)="closeBulk()"
        (submitted)="onBulk($event)"
      />
    }
  `,
  styles: [
    `
      :host { display: block; }
      .table { @apply w-full text-sm text-left; }
      .table th {
        @apply px-4 py-3 font-semibold text-content-muted uppercase text-xs tracking-wider border-b border-border-subtle bg-surface-subtle;
      }
      .table td {
        @apply px-4 py-3 border-b border-border-subtle;
      }
      .table tr:last-child td { border-bottom: none; }
      .badge {
        @apply inline-flex items-center px-2 py-0.5 rounded text-xs;
      }
      .badge-neutral {
        @apply bg-surface-subtle text-content;
      }
    `
  ]
})
export class GradeRecordsPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(GradeRecordsStore);
  private readonly evaluationsApi = inject(EvaluationsApiService);

  protected readonly scaleScore = EvaluationScale.SCORE_0_20;
  protected readonly scoreMin = SCORE_MIN;
  protected readonly scoreMax = SCORE_MAX;
  protected readonly commentsMaxLength = 1000;

  protected readonly evaluation = signal<EvaluationDetail | null>(null);

  protected readonly rows = this.store.rows;
  protected readonly loading = this.store.loading;
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;
  protected readonly lastBulk = this.store.lastBulk;
  protected readonly counts = this.store.counts;

  protected readonly showCreate = signal<boolean>(false);
  protected readonly showBulk = signal<boolean>(false);
  protected readonly editing = signal<GradeRecordRow | null>(null);
  protected readonly editState = signal<InlineEditState | null>(null);

  protected readonly title = computed(() => {
    const e = this.evaluation();
    return e ? `Notas — ${e.name}` : 'Calificaciones';
  });
  protected readonly subtitle = computed(() => {
    const e = this.evaluation();
    return e ? e.assignment.label : '';
  });

  protected readonly scale = computed<EvaluationScale>(
    () => this.evaluation()?.scale ?? EvaluationScale.SCORE_0_20
  );
  protected readonly allowedLiterals = computed(
    () => ALLOWED_LITERALS_BY_SCALE[this.scale()]
  );
  protected readonly valueColumn = computed(() =>
    this.scale() === EvaluationScale.SCORE_0_20 ? 'Nota' : 'Literal'
  );

  private routeSub?: Subscription;
  private currentEvaluationUuid: string | null = null;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const uuid = params.get('publicUuid');
      if (!uuid) {
        await this.router.navigate([ROUTES.DASHBOARD.ROOT]);
        return;
      }
      this.currentEvaluationUuid = uuid;
      await this.loadAll(uuid);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.store.clear();
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected canEdit(): boolean {
    const e = this.evaluation();
    return !!e && areGradesEditable(e.status);
  }

  protected scaleLabel(s: EvaluationScale): string {
    return EVALUATION_SCALE_LABELS[s];
  }

  protected statusLabel(s: EvaluationStatus): string {
    return s === EvaluationStatus.CLOSED
      ? 'Cerrada'
      : s === EvaluationStatus.PUBLISHED
        ? 'Publicada'
        : 'Borrador';
  }

  protected shorten(uuid: string): string {
    return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;
  }

  protected formatRecorded(d: Date | null): string {
    if (!d) return '—';
    return d.toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected busyRow(publicUuid: string): boolean {
    return this.store.busyRowUuids().has(publicUuid);
  }

  protected goBack(): void {
    const e = this.evaluation();
    if (e) {
      void this.router.navigate([ROUTES.EVALUATIONS.detail(e.publicUuid)]);
    } else {
      history.back();
    }
  }

  protected async reload(): Promise<void> {
    if (!this.currentEvaluationUuid) return;
    this.store.clearError();
    await this.loadAll(this.currentEvaluationUuid);
  }

  protected clearError(): void {
    this.store.clearError();
  }

  protected dismissBulk(): void {
    this.store.clearBulkSummary();
  }

  // ===========================================================================
  // Inline editing
  // ===========================================================================

  protected isEditing(
    publicUuid: string,
    field: InlineEditState['field']
  ): boolean {
    const s = this.editState();
    return !!s && s.publicUuid === publicUuid && s.field === field;
  }

  protected startEditValue(row: GradeRecordRow): void {
    if (!this.canEdit() || this.busyRow(row.publicUuid)) return;
    const isScore = this.scale() === EvaluationScale.SCORE_0_20;
    this.editState.set({
      publicUuid: row.publicUuid,
      field: isScore ? 'score' : 'literal',
      value: isScore
        ? row.score !== null
          ? String(row.score)
          : ''
        : row.literal ?? '',
      error: null
    });
  }

  protected startEditComments(row: GradeRecordRow): void {
    if (!this.canEdit() || this.busyRow(row.publicUuid)) return;
    this.editState.set({
      publicUuid: row.publicUuid,
      field: 'comments',
      value: row.comments ?? '',
      error: null
    });
  }

  protected onEditChange(value: string): void {
    const s = this.editState();
    if (!s) return;
    this.editState.set({ ...s, value, error: null });
  }

  protected cancelEdit(): void {
    this.editState.set(null);
  }

  protected async saveEdit(row: GradeRecordRow): Promise<void> {
    const s = this.editState();
    if (!s || s.publicUuid !== row.publicUuid) return;

    const result = this.toPatch(s, row);
    if (result.kind === 'error') {
      this.editState.set({ ...s, error: result.message });
      return;
    }
    if (result.kind === 'unchanged') {
      this.editState.set(null);
      return;
    }

    this.editState.set(null);
    await this.store.update(row.publicUuid, result.payload);
  }

  /**
   * Construye el patch para PUT a partir del inline edit. Devuelve
   * {@code error} si la validación cliente falla, o {@code unchanged}
   * cuando el valor final iguala al original (evitamos un round-trip).
   */
  private toPatch(
    s: InlineEditState,
    row: GradeRecordRow
  ): InlineEditOutcome {
    if (s.field === 'score') {
      const trimmed = s.value.trim();
      if (trimmed === '') {
        return { kind: 'error', message: 'La nota no puede estar vacía.' };
      }
      const n = Number(trimmed.replace(',', '.'));
      if (!Number.isFinite(n)) {
        return { kind: 'error', message: 'Nota debe ser numérica.' };
      }
      const shape = validateGradeShape(this.scale(), { score: n });
      if (shape) return { kind: 'error', message: shape };
      if (row.score === n) return { kind: 'unchanged' };
      return { kind: 'patch', payload: { score: n } };
    }

    if (s.field === 'literal') {
      const literal = s.value.trim().toUpperCase();
      if (!literal) {
        return { kind: 'error', message: 'Selecciona un literal.' };
      }
      const shape = validateGradeShape(this.scale(), { literal });
      if (shape) return { kind: 'error', message: shape };
      if (row.literal === literal) return { kind: 'unchanged' };
      return { kind: 'patch', payload: { literal } };
    }

    // comments
    const finalValue = s.value.trim();
    if ((row.comments ?? '') === finalValue) {
      return { kind: 'unchanged' };
    }
    if (finalValue.length > this.commentsMaxLength) {
      return {
        kind: 'error',
        message: `Máximo ${this.commentsMaxLength} caracteres.`
      };
    }
    return { kind: 'patch', payload: { comments: finalValue } };
  }

  // ===========================================================================
  // Modals
  // ===========================================================================

  protected openCreate(): void {
    this.store.clearError();
    this.showCreate.set(true);
  }

  protected closeCreate(): void {
    this.showCreate.set(false);
  }

  protected async onCreate(payload: CreateGradeRecordRequest): Promise<void> {
    if (!this.currentEvaluationUuid) return;
    const result = await this.store.upsert(this.currentEvaluationUuid, payload);
    if (result) {
      this.showCreate.set(false);
    }
  }

  protected openEdit(row: GradeRecordRow): void {
    this.store.clearError();
    this.editing.set(row);
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected async onUpdateFromModal(
    row: GradeRecordRow,
    payload: CreateGradeRecordRequest
  ): Promise<void> {
    const result = await this.store.update(row.publicUuid, {
      score: payload.score ?? null,
      literal: payload.literal ?? null,
      comments: payload.comments ?? null
    });
    if (result) {
      this.editing.set(null);
    }
  }

  protected async onDelete(row: GradeRecordRow): Promise<void> {
    const ok = confirm(
      `¿Borrar la nota de ${row.studentFullName}?\n\n` +
        'Soft-delete: queda en BD pero deja de aparecer.'
    );
    if (!ok) return;
    await this.store.remove(row.publicUuid);
  }

  protected openBulk(): void {
    this.store.clearError();
    this.showBulk.set(true);
  }

  protected closeBulk(): void {
    this.showBulk.set(false);
  }

  protected async onBulk(records: CreateGradeRecordRequest[]): Promise<void> {
    if (!this.currentEvaluationUuid) return;
    const result = await this.store.bulkUpsert(
      this.currentEvaluationUuid,
      records
    );
    if (result) {
      this.showBulk.set(false);
    }
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private async loadAll(evaluationUuid: string): Promise<void> {
    try {
      const evaluation = await firstValueFrom(
        this.evaluationsApi.getEvaluation(evaluationUuid)
      );
      this.evaluation.set(evaluation);
    } catch {
      this.evaluation.set(null);
    }
    await this.store.loadByEvaluation(evaluationUuid);
  }
}

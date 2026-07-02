import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  EvaluationFormModalComponent,
  EvaluationKindBadgeComponent,
  EvaluationRubricTabComponent,
  EvaluationStatusBadgeComponent,
} from '../../components';
import { EvaluationsStore } from '../../store';
import {
  EVALUATION_KIND_LABELS,
  EVALUATION_SCALE_LABELS,
  EvaluationDetail,
  EvaluationStatus,
  isEvaluationDeletable,
  isEvaluationEditable,
  legalNextStatuses,
} from '../../models';

type TabId = 'overview' | 'rubric' | 'grades';

interface TabDef {
  id: TabId;
  label: string;
  icon: 'info' | 'layers' | 'target';
}

const TABS: readonly TabDef[] = [
  { id: 'overview', label: 'Resumen', icon: 'info' },
  { id: 'rubric', label: 'Rúbrica', icon: 'layers' },
  { id: 'grades', label: 'Calificaciones', icon: 'target' },
];

/**
 * `/evaluations/:publicUuid` — Detail page con tabs (FE-5B.1 + FE-5B.5).
 *
 * <h3>Tabs</h3>
 * <ul>
 *   <li><b>Resumen</b> — meta, lifecycle controls, anchors.</li>
 *   <li><b>Rúbrica</b> — sub-tab de FE-5B.5: vincular/reemplazar/desvincular
 *       rúbrica con preview read-only.</li>
 *   <li><b>Calificaciones</b> — placeholder para FE-5B.3 (link al stand-alone
 *       /evaluations/:uuid/grades por ahora).</li>
 * </ul>
 */
@Component({
  selector: 'app-evaluation-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EvaluationFormModalComponent,
    EvaluationKindBadgeComponent,
    EvaluationRubricTabComponent,
    EvaluationStatusBadgeComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header eyebrow="Evaluaciones" [title]="title()" [subtitle]="subtitle()">
        <button type="button" class="btn btn-ghost btn-sm" (click)="goBack()">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </button>
        @if (evaluation(); as e) {
          @for (next of legalNext(e.status); track next) {
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              [disabled]="saving()"
              (click)="onLifecycleHop(next)"
            >
              @if (next === 'PUBLISHED') {
                <app-icon name="check" [size]="16" />
                <span>Publicar</span>
              } @else if (next === 'CLOSED') {
                <app-icon name="lock" [size]="16" />
                <span>Cerrar</span>
              }
            </button>
          }
          @if (canEdit()) {
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              [disabled]="saving()"
              (click)="openEdit()"
            >
              <app-icon name="pencil" [size]="16" />
              <span>Editar</span>
            </button>
          }
        }
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando evaluación…" />
        </div>
      } @else if (errorBanner() && !evaluation()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <p class="flex-1 text-sm">{{ errorBanner() }}</p>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">Reintentar</button>
        </div>
      }

      @if (!loading() && evaluation(); as e) {
        <!-- Status row -->
        <div class="mb-6 flex flex-wrap items-center gap-3">
          <app-evaluation-kind-badge [kind]="e.kind" />
          <app-evaluation-status-badge [status]="e.status" />
          <span class="text-sm text-content-muted">
            {{ scaleLabel(e.scale) }}
          </span>
          <span class="text-sm text-content-muted"> · Peso {{ e.weight | number: '1.0-2' }} </span>
          <span class="text-sm text-content-muted"> · {{ e.gradeCount }} calificada(s) </span>
        </div>

        <!-- Tabs nav -->
        <nav class="mb-6 flex flex-wrap gap-1 border-b border-border-subtle" role="tablist">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              role="tab"
              class="flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors"
              [class.border-primary-600]="activeTab() === t.id"
              [class.text-primary-700]="activeTab() === t.id"
              [class.border-transparent]="activeTab() !== t.id"
              [class.text-content-muted]="activeTab() !== t.id"
              [class.hover:text-content]="activeTab() !== t.id"
              [attr.aria-selected]="activeTab() === t.id"
              (click)="setTab(t.id)"
            >
              <app-icon [name]="t.icon" [size]="14" />
              <span>{{ t.label }}</span>
            </button>
          }
        </nav>

        @if (activeTab() === 'overview') {
          <section class="grid gap-6 lg:grid-cols-2">
            <article class="card">
              <header class="card-header">
                <h3 class="card-title">Información general</h3>
              </header>
              <div class="card-body grid gap-3">
                <dl class="grid gap-3">
                  <div>
                    <dt class="text-xs text-content-muted">Asignación</dt>
                    <dd class="text-sm font-medium">
                      {{ e.assignment.label }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-content-muted">Tipo</dt>
                    <dd class="text-sm">{{ kindLabel(e.kind) }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-content-muted">Escala</dt>
                    <dd class="text-sm">{{ scaleLabel(e.scale) }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-content-muted">Peso</dt>
                    <dd class="text-sm tabular-nums">
                      {{ e.weight | number: '1.0-2' }}
                    </dd>
                  </div>
                  @if (e.description) {
                    <div>
                      <dt class="text-xs text-content-muted">Descripción</dt>
                      <dd class="whitespace-pre-line text-sm">
                        {{ e.description }}
                      </dd>
                    </div>
                  }
                </dl>
              </div>
            </article>

            <article class="card">
              <header class="card-header">
                <h3 class="card-title">Fechas y lifecycle</h3>
              </header>
              <div class="card-body grid gap-3">
                <dl class="grid gap-3">
                  <div>
                    <dt class="text-xs text-content-muted">Programada</dt>
                    <dd class="text-sm">
                      {{ formatDate(e.scheduledDate) }}
                    </dd>
                  </div>
                  @if (e.dueDate) {
                    <div>
                      <dt class="text-xs text-content-muted">Entrega</dt>
                      <dd class="text-sm">{{ formatDate(e.dueDate) }}</dd>
                    </div>
                  }
                  @if (e.publishedAt) {
                    <div>
                      <dt class="text-xs text-content-muted">Publicada</dt>
                      <dd class="text-sm">
                        {{ formatInstant(e.publishedAt) }}
                      </dd>
                    </div>
                  }
                  @if (e.closedAt) {
                    <div>
                      <dt class="text-xs text-content-muted">Cerrada</dt>
                      <dd class="text-sm">{{ formatInstant(e.closedAt) }}</dd>
                    </div>
                  }
                  @if (e.unitPublicUuid) {
                    <div>
                      <dt class="text-xs text-content-muted">Unidad anclada</dt>
                      <dd class="break-all font-mono text-xs">
                        {{ e.unitPublicUuid }}
                      </dd>
                    </div>
                  }
                  @if (e.learningSessionPublicUuid) {
                    <div>
                      <dt class="text-xs text-content-muted">Sesión anclada</dt>
                      <dd class="break-all font-mono text-xs">
                        {{ e.learningSessionPublicUuid }}
                      </dd>
                    </div>
                  }
                </dl>
              </div>
            </article>
          </section>

          @if (canDelete()) {
            <section class="border-danger-200 bg-danger-50 mt-6 rounded-md border p-4">
              <div class="flex items-start gap-3">
                <app-icon name="alert-circle" [size]="20" class="text-danger-600" />
                <div class="flex-1">
                  <h4 class="text-danger-700 font-medium">Zona peligrosa</h4>
                  <p class="text-danger-600 mt-1 text-sm">
                    Esta evaluación es un borrador sin calificaciones. Eliminarla la quita del
                    listado del docente.
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm text-danger-700 hover:bg-danger-100"
                  [disabled]="saving()"
                  (click)="onDelete()"
                >
                  Eliminar
                </button>
              </div>
            </section>
          }
        } @else if (activeTab() === 'rubric') {
          <app-evaluation-rubric-tab [evaluation]="e" />
        } @else if (activeTab() === 'grades') {
          <div class="rounded-md border border-border-subtle p-6 text-center">
            <app-icon name="target" [size]="32" class="mx-auto mb-3 text-content-muted" />
            <p class="text-sm font-medium">{{ e.gradeCount }} nota(s) registrada(s)</p>
            <p class="mx-auto mt-1 max-w-md text-xs text-content-muted">
              Tabla con bulk CSV inline disponible en la pantalla dedicada de calificaciones.
            </p>
            <button
              type="button"
              class="btn btn-primary btn-sm mt-4"
              (click)="goToGrades(e.publicUuid)"
            >
              <app-icon name="target" [size]="16" />
              <span>Abrir calificaciones</span>
            </button>
          </div>
        }
      }
    </app-page-container>

    @if (editing(); as e) {
      <app-evaluation-form-modal [evaluation]="e" (closed)="closeEdit()" (saved)="onEdited()" />
    }
  `,
})
export class EvaluationDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(EvaluationsStore);

  protected readonly evaluation = this.store.selected;
  protected readonly loading = this.store.loadingDetail;
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly tabs = TABS;
  protected readonly activeTab = signal<TabId>('overview');
  protected readonly editing = signal<EvaluationDetail | null>(null);

  protected readonly title = computed(() => this.evaluation()?.name ?? 'Evaluación');
  protected readonly subtitle = computed(() => this.evaluation()?.assignment.label ?? '');

  private routeSub?: Subscription;
  private currentUuid: string | null = null;

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const uuid = params.get('publicUuid');
      if (!uuid) {
        await this.router.navigate([ROUTES.DASHBOARD.ROOT]);
        return;
      }
      this.currentUuid = uuid;
      await this.loadAll(uuid);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.store.clearSelected();
  }

  // ===========================================================================
  // Tabs
  // ===========================================================================

  protected setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  protected legalNext(status: EvaluationStatus): EvaluationStatus[] {
    return legalNextStatuses(status);
  }

  protected canEdit(): boolean {
    const e = this.evaluation();
    return !!e && isEvaluationEditable(e.status);
  }

  protected canDelete(): boolean {
    const e = this.evaluation();
    return !!e && isEvaluationDeletable(e.status) && e.gradeCount === 0;
  }

  protected async onLifecycleHop(target: EvaluationStatus): Promise<void> {
    const e = this.evaluation();
    if (!e) return;
    const fromLabel = e.status;
    const ok = confirm(
      `¿Cambiar la evaluación "${e.name}" a ${target}?` +
        (target === EvaluationStatus.CLOSED ? '\n\nUna vez cerrada NO se podrá reabrir.' : ''),
    );
    if (!ok) return;

    if (target === EvaluationStatus.PUBLISHED) {
      await this.store.publish(e.publicUuid);
    } else if (target === EvaluationStatus.CLOSED) {
      await this.store.close(e.publicUuid);
    }
    void fromLabel; // silenciar warning si lint quisiera advertir.
  }

  protected async onDelete(): Promise<void> {
    const e = this.evaluation();
    if (!e) return;
    const ok = confirm(
      `¿Eliminar el borrador "${e.name}"?\n\n` +
        'Solo se permite eliminar borradores sin calificaciones.',
    );
    if (!ok) return;
    const success = await this.store.remove(e.publicUuid);
    if (success) {
      void this.router.navigate([ROUTES.EVALUATIONS.byAssignment(e.assignment.publicUuid)]);
    }
  }

  protected openEdit(): void {
    const e = this.evaluation();
    if (!e) return;
    this.store.clearError();
    this.editing.set(e);
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected onEdited(): void {
    this.editing.set(null);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected kindLabel(k: EvaluationDetail['kind']): string {
    return EVALUATION_KIND_LABELS[k];
  }

  protected scaleLabel(s: EvaluationDetail['scale']): string {
    return EVALUATION_SCALE_LABELS[s];
  }

  protected formatDate(d: Date): string {
    return d.toLocaleDateString('es', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  protected formatInstant(d: Date): string {
    return d.toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected goBack(): void {
    const e = this.evaluation();
    if (e) {
      void this.router.navigate([ROUTES.EVALUATIONS.byAssignment(e.assignment.publicUuid)]);
    } else {
      history.back();
    }
  }

  protected goToGrades(publicUuid: string): void {
    void this.router.navigate([ROUTES.EVALUATIONS.grades(publicUuid)]);
  }

  protected async reload(): Promise<void> {
    if (!this.currentUuid) return;
    this.store.clearError();
    await this.loadAll(this.currentUuid);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async loadAll(publicUuid: string): Promise<void> {
    await this.store.loadDetail(publicUuid);
    await this.store.loadAttachedRubric(publicUuid);
  }
}

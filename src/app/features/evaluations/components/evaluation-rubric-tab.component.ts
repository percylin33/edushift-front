import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import { RubricSystemBadgeComponent } from '@features/rubrics/components/rubric-system-badge.component';
import { RubricDetail } from '@features/rubrics/models';
import { EvaluationsStore } from '../store';
import { EvaluationDetail } from '../models';
import { RubricAttachModalComponent } from './rubric-attach-modal.component';

/**
 * Sub-tab "Rúbrica" del evaluation-detail (FE-5B.5).
 *
 * <h3>Estados</h3>
 * <ul>
 *   <li><b>Sin rúbrica</b> → empty-state con CTA "Vincular rúbrica".</li>
 *   <li><b>Vinculada</b> → preview read-only de criterios + niveles +
 *       descriptores, con acciones "Reemplazar" y "Desvincular".</li>
 *   <li><b>Cargando</b> → spinner.</li>
 *   <li><b>Error</b> → banner con retry.</li>
 * </ul>
 *
 * <p>Cualquier acción (vincular / reemplazar / desvincular) invalida
 * el estado del store; el componente reactiona vía signals — sin necesidad
 * de prop drilling al detail page.</p>
 */
@Component({
  selector: 'app-evaluation-rubric-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    IconComponent,
    RubricAttachModalComponent,
    RubricSystemBadgeComponent,
    SpinnerComponent
  ],
  template: `
    @if (loading()) {
      <div class="flex items-center justify-center py-10">
        <app-spinner [size]="24" label="Cargando rúbrica…" />
      </div>
    } @else if (errorBanner()) {
      <div class="alert alert-danger">
        <app-icon name="alert-circle" [size]="18" />
        <p class="flex-1 text-sm">{{ errorBanner() }}</p>
        <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
          Reintentar
        </button>
      </div>
    } @else if (!rubric()) {
      <app-empty-state
        icon="layers"
        title="Sin rúbrica vinculada"
        description="Vincula una rúbrica para guiar la evaluación con criterios y niveles. La rúbrica no afecta los GradeRecords; es referencia pedagógica."
      >
        <button
          type="button"
          class="btn btn-primary btn-sm"
          [disabled]="saving()"
          (click)="openAttach()"
        >
          <app-icon name="plus" [size]="16" />
          <span>Vincular rúbrica</span>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          (click)="goToRubrics()"
        >
          <app-icon name="layers" [size]="16" />
          <span>Ver catálogo</span>
        </button>
      </app-empty-state>
    }

    @if (!loading() && !errorBanner() && rubric(); as r) {
      <article class="grid gap-6">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold">{{ r.name }}</h3>
              <app-rubric-system-badge
                [isSystem]="r.isSystem"
                [parentPublicUuid]="r.parentRubricPublicUuid"
              />
            </div>
            @if (r.description) {
              <p class="text-sm text-content-muted mt-1 max-w-2xl">
                {{ r.description }}
              </p>
            }
            <p class="text-xs text-content-muted mt-2">
              {{ r.criteria.length }} criterios · {{ r.levels.length }} niveles
              · pesos suman {{ totalWeight() | number: '1.0-2' }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <a
              [href]="rubricDetailUrl(r.publicUuid)"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost btn-xs"
              title="Abrir en /rubrics"
            >
              <app-icon name="eye" [size]="14" />
              <span>Ver completa</span>
            </a>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              [disabled]="saving()"
              (click)="openReplace()"
            >
              <app-icon name="layers" [size]="14" />
              <span>Reemplazar</span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50"
              [disabled]="saving()"
              (click)="onDetach()"
            >
              <app-icon name="x" [size]="14" />
              <span>Desvincular</span>
            </button>
          </div>
        </header>

        <!-- Preview read-only matriz criterio × nivel -->
        <div class="overflow-x-auto rounded-lg border border-border-subtle">
          <table class="table">
            <thead>
              <tr>
                <th class="w-32">Criterio</th>
                <th class="w-20 text-right">Peso</th>
                @for (lvl of r.levels; track lvl.code) {
                  <th class="min-w-[140px]">
                    <span class="font-mono text-xs">{{ lvl.code }}</span>
                    <br />
                    <span class="text-xs text-content-muted normal-case">
                      {{ lvl.name }}
                    </span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (c of r.criteria; track c.key) {
                <tr class="align-top">
                  <td>
                    <p class="font-medium">{{ c.name }}</p>
                    @if (c.description) {
                      <p class="text-xs text-content-muted mt-1">
                        {{ c.description }}
                      </p>
                    }
                  </td>
                  <td class="text-right tabular-nums">
                    {{ c.weight | number: '1.0-2' }}
                  </td>
                  @for (lvl of r.levels; track lvl.code) {
                    <td class="text-xs text-content-muted">
                      {{ getDescriptor(c.descriptors, lvl.code) || '—' }}
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </article>
    }

    @if (showAttach()) {
      <app-rubric-attach-modal
        [excludeUuid]="rubric()?.publicUuid"
        [replacing]="replaceMode()"
        [saving]="saving()"
        (closed)="closeAttach()"
        (selected)="onSelectRubric($event)"
      />
    }
  `,
  styles: [
    `
      :host { display: block; }
      .table {
        @apply w-full text-sm text-left;
      }
      .table th {
        @apply px-3 py-2 font-semibold text-content-muted uppercase text-xs tracking-wider border-b border-border-subtle bg-surface-subtle;
      }
      .table td {
        @apply px-3 py-2 border-b border-border-subtle;
      }
      .table tr:last-child td {
        border-bottom: none;
      }
    `
  ]
})
export class EvaluationRubricTabComponent {
  private readonly store = inject(EvaluationsStore);
  private readonly router = inject(Router);

  readonly evaluation = input.required<EvaluationDetail>();

  protected readonly rubric = this.store.attachedRubric;
  protected readonly loading = this.store.loadingRubric;
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly showAttach = signal<boolean>(false);
  protected readonly replaceMode = signal<boolean>(false);

  protected readonly totalWeight = computed(() =>
    (this.rubric()?.criteria ?? []).reduce((acc, c) => acc + c.weight, 0)
  );

  protected getDescriptor(
    descriptors: { level: string; text: string }[],
    levelCode: string
  ): string {
    return descriptors.find((d) => d.level === levelCode)?.text ?? '';
  }

  protected rubricDetailUrl(publicUuid: string): string {
    return ROUTES.RUBRICS.detail(publicUuid);
  }

  protected goToRubrics(): void {
    void this.router.navigate([ROUTES.RUBRICS.LIST]);
  }

  protected openAttach(): void {
    this.store.clearError();
    this.replaceMode.set(false);
    this.showAttach.set(true);
  }

  protected openReplace(): void {
    this.store.clearError();
    this.replaceMode.set(true);
    this.showAttach.set(true);
  }

  protected closeAttach(): void {
    this.showAttach.set(false);
  }

  protected async onSelectRubric(rubricPublicUuid: string): Promise<void> {
    const result = await this.store.attachRubric(
      this.evaluation().publicUuid,
      rubricPublicUuid
    );
    if (result) {
      this.showAttach.set(false);
    }
  }

  protected async onDetach(): Promise<void> {
    const r = this.rubric();
    if (!r) return;
    const ok = confirm(
      `¿Desvincular la rúbrica "${r.name}"?\n\n` +
        'No se borrará nada de la rúbrica original. Solo se quita el ' +
        'enlace con esta evaluación.'
    );
    if (!ok) return;
    await this.store.detachRubric(this.evaluation().publicUuid);
  }

  protected async reload(): Promise<void> {
    this.store.clearError();
    await this.store.loadAttachedRubric(this.evaluation().publicUuid);
  }
}

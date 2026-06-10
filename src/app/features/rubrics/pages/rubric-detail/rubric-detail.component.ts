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
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import {
  ForkRubricModalComponent,
  RubricSystemBadgeComponent
} from '../../components';
import { RubricsStore } from '../../store';
import { RubricRow } from '../../models';

/**
 * `/rubrics/:publicUuid` — Detail read-only que muestra el rubric en
 * formato matriz "criterio × nivel" para revisión. Acciones:
 * Editar (si no es system), Forkear, Volver al listado.
 */
@Component({
  selector: 'app-rubric-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ForkRubricModalComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    RubricSystemBadgeComponent,
    SpinnerComponent
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Rúbricas"
        [title]="title()"
        [subtitle]="subtitle()"
      >
        @if (rubric(); as r) {
          <app-rubric-system-badge
            [isSystem]="r.isSystem"
            [parentPublicUuid]="r.parentRubricPublicUuid"
          />
        }
        <button type="button" class="btn btn-ghost btn-sm" (click)="goBack()">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </button>
        @if (rubric() && !rubric()!.isSystem) {
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="goToEdit()"
          >
            <app-icon name="pencil" [size]="16" />
            <span>Editar</span>
          </button>
        }
        <button
          type="button"
          class="btn btn-primary btn-sm"
          [disabled]="!rubric()"
          (click)="openFork()"
        >
          <app-icon name="layers" [size]="16" />
          <span>Forkear</span>
        </button>
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando rúbrica…" />
        </div>
      } @else if (errorBanner()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <p class="flex-1 text-sm">{{ errorBanner() }}</p>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="reload()"
          >
            Reintentar
          </button>
        </div>
      }

      @if (!loading() && !errorBanner() && rubric(); as r) {
        @if (r.description) {
          <p class="text-sm text-content-muted mb-6 max-w-3xl">
            {{ r.description }}
          </p>
        }

        <!-- Niveles -->
        <section class="card mb-6">
          <header class="card-header">
            <h3 class="card-title">Niveles de logro ({{ r.levels.length }})</h3>
          </header>
          <div class="card-body">
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th class="w-32">Código</th>
                    <th>Nombre</th>
                    <th class="w-20">Orden</th>
                  </tr>
                </thead>
                <tbody>
                  @for (lvl of r.levels; track lvl.code) {
                    <tr>
                      <td class="font-mono">{{ lvl.code }}</td>
                      <td>{{ lvl.name }}</td>
                      <td class="text-content-muted">{{ lvl.order ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Criterios -->
        <section class="card">
          <header class="card-header">
            <div>
              <h3 class="card-title">Criterios ({{ r.criteria.length }})</h3>
              <p class="card-description">
                Pesos suman {{ totalWeight() | number: '1.0-2' }}.
              </p>
            </div>
          </header>
          <div class="card-body">
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th class="w-40">Key</th>
                    <th>Criterio</th>
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
                      <td class="font-mono text-xs">{{ c.key }}</td>
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
          </div>
        </section>
      }
    </app-page-container>

    @if (forkOrigin(); as origin) {
      <app-fork-rubric-modal
        [origin]="origin"
        (closed)="closeFork()"
        (forked)="onForked($event)"
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
    `
  ]
})
export class RubricDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(RubricsStore);

  protected readonly rubric = this.store.selected;
  protected readonly loading = this.store.loadingDetail;
  protected readonly errorBanner = this.store.error;

  protected readonly forkOrigin = signal<RubricRow | null>(null);

  protected readonly title = computed(
    () => this.rubric()?.name ?? 'Rúbrica'
  );
  protected readonly subtitle = computed(() => {
    const r = this.rubric();
    if (!r) return '';
    return `${r.criteria.length} criterios · ${r.levels.length} niveles`;
  });

  protected readonly totalWeight = computed(() =>
    (this.rubric()?.criteria ?? []).reduce((acc, c) => acc + c.weight, 0)
  );

  private routeSub?: Subscription;
  private currentUuid: string | null = null;

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const uuid = params.get('publicUuid');
      if (!uuid) {
        await this.router.navigate([ROUTES.RUBRICS.LIST]);
        return;
      }
      this.currentUuid = uuid;
      await this.store.loadDetail(uuid);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.store.clearSelected();
  }

  protected getDescriptor(
    descriptors: { level: string; text: string }[],
    levelCode: string
  ): string {
    return descriptors.find((d) => d.level === levelCode)?.text ?? '';
  }

  protected async reload(): Promise<void> {
    if (!this.currentUuid) return;
    this.store.clearError();
    await this.store.loadDetail(this.currentUuid);
  }

  protected goBack(): void {
    void this.router.navigate([ROUTES.RUBRICS.LIST]);
  }

  protected goToEdit(): void {
    const r = this.rubric();
    if (!r) return;
    void this.router.navigate([ROUTES.RUBRICS.edit(r.publicUuid)]);
  }

  protected openFork(): void {
    const r = this.rubric();
    if (!r) return;
    this.store.clearError();
    this.forkOrigin.set({
      publicUuid: r.publicUuid,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      parentRubricPublicUuid: r.parentRubricPublicUuid,
      criterionCount: r.criteria.length,
      criterionSummary: r.criteria.map((c) => `${c.weight}% ${c.name}`),
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    });
  }

  protected closeFork(): void {
    this.forkOrigin.set(null);
  }

  protected onForked(publicUuid: string): void {
    this.forkOrigin.set(null);
    void this.router.navigate([ROUTES.RUBRICS.edit(publicUuid)]);
  }
}

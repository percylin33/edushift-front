import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PageContainerComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components';
import { SpinnerComponent } from '@shared/components';
import { IconComponent } from '@shared/components';

import { WalkthroughService } from '../../services/walkthrough.service';
import { WalkthroughProgressService } from '../../services/walkthrough-progress.service';
import {
  RoleKey,
  WALKTHROUGH_FILES,
  Walkthrough,
  WalkthroughFeature,
  WalkthroughStep,
} from '../../models/walkthrough.model';

/**
 * Centro de Pruebas / Guías — viewer at `/help/guides/:roleKey`.
 *
 * <p>Loads the matching `qa-walkthroughs/<roleKey>.md` asset, parses
 * the feature blocks, and renders each step with a checkbox. The
 * checked state lives in localStorage so closing and reopening the tab
 * keeps the progress.</p>
 */
@Component({
  selector: 'app-walkthrough-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
    IconComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        [eyebrow]="eyebrow()"
        [title]="title()"
        [subtitle]="subtitle()"
      >
        <a
          routerLink="/help/guides"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="arrow-left" [size]="14" />
          Todas las guías
        </a>
        <a
          routerLink="/help"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="layout-grid" [size]="14" />
          Centro de pruebas
        </a>
        <button
          type="button"
          (click)="resetProgress()"
          [disabled]="!hasAnyProgress()"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted disabled:opacity-50"
        >
          <app-icon name="rotate-ccw" [size]="14" />
          Limpiar progreso
        </button>
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <app-spinner [size]="20" />
        </div>
      } @else {
        @if (loadError(); as err) {
          <div
            role="alert"
            class="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <p class="font-medium">No se pudo cargar la guía.</p>
            <p class="mt-1 text-danger/80">{{ err }}</p>
            <button
              type="button"
              (click)="reload()"
              class="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            >
              <app-icon name="rotate-ccw" [size]="14" />
              Reintentar
            </button>
          </div>
        } @else {
          @if (walkthrough(); as w) {
            <p
              class="mb-6 whitespace-pre-wrap rounded-md border border-border-subtle bg-surface-muted p-3 text-sm text-content-muted"
            >
              {{ w.intro }}
            </p>

          <div class="mb-4 flex items-center gap-3 text-xs">
            <div class="rounded-md bg-success/10 px-3 py-2">
              <p class="text-2xs uppercase text-content-subtle">Pasos completados</p>
              <p class="text-base font-semibold">
                {{ completedCount() }} / {{ totalCount() }}
              </p>
            </div>
            <div
              class="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
              [attr.aria-label]="'Progreso de la guía'"
            >
              <div
                class="h-full bg-success transition-all"
                [style.width.%]="progressPercent()"
              ></div>
            </div>
            <span class="font-mono text-2xs text-content-subtle">
              {{ progressPercent() }}%
            </span>
          </div>

          <ol class="space-y-6">
            @for (feature of w.features; track feature.heading) {
              <li class="rounded-lg border border-border bg-surface p-5">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 class="text-base font-semibold text-content">
                    {{ feature.heading }}
                  </h2>
                  @if (feature.capabilityId) {
                    <span
                      class="rounded-full bg-surface-muted px-2 py-0.5 font-mono text-2xs text-content-subtle"
                    >
                      {{ feature.capabilityId }}
                    </span>
                  }
                  <span class="text-2xs text-content-subtle">
                    {{ featureDoneCount(feature) }} / {{ feature.steps.length }} pasos
                  </span>
                </div>

                @if (feature.steps.length === 0) {
                  <p class="text-xs text-content-muted">
                    Esta sección no tiene pasos verificables (texto descriptivo).
                  </p>
                } @else {
                  <ul class="divide-y divide-border-subtle">
                    @for (step of feature.steps; track step.id) {
                      <li
                        class="flex items-start gap-3 py-3"
                        [class.opacity-60]="isStepDone(feature, step)"
                      >
                        <input
                          type="checkbox"
                          class="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
                          [id]="checkboxId(feature, step)"
                          [checked]="isStepDone(feature, step)"
                          (change)="onToggle(feature, step)"
                          [attr.aria-label]="'Marcar paso ' + step.index + ' como probado'"
                        />
                        <label
                          [for]="checkboxId(feature, step)"
                          class="flex-1 cursor-pointer space-y-1"
                        >
                          <div class="flex flex-wrap items-baseline gap-2">
                            <span class="font-mono text-2xs text-content-subtle">#{{ step.index }}</span>
                            <span
                              class="text-sm font-medium text-content"
                              [class.line-through]="isStepDone(feature, step)"
                            >
                              {{ step.action }}
                            </span>
                            @if (step.endpoint !== '—' && step.endpoint) {
                              <span
                                class="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-2xs text-content-subtle"
                              >
                                {{ step.endpoint }}
                              </span>
                            }
                          </div>
                          @if (step.payload !== '—' && step.payload) {
                            <p class="text-2xs text-content-subtle">
                              <span class="font-semibold">Payload:</span> {{ step.payload }}
                            </p>
                          }
                          @if (step.successCriterion !== '—' && step.successCriterion) {
                            <p class="text-2xs text-content-subtle">
                              <span class="font-semibold">Éxito:</span> {{ step.successCriterion }}
                            </p>
                          }
                          @if (step.testId !== '—' && step.testId) {
                            <p class="font-mono text-2xs text-content-subtle">
                              {{ step.testId }}
                            </p>
                          }
                          @if (step.notes) {
                            <p class="text-2xs italic text-content-muted">
                              {{ step.notes }}
                            </p>
                          }
                        </label>
                      </li>
                    }
                  </ul>
                }
              </li>
            }
          </ol>
          }
        }
      }
    </app-page-container>
  `,
})
export class WalkthroughViewerPageComponent {
  readonly roleKey = input.required<string>();

  private readonly walkthroughService = inject(WalkthroughService);
  private readonly progressService = inject(WalkthroughProgressService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly walkthrough = signal<Walkthrough | null>(null);

  readonly title = computed(() => {
    const w = this.walkthrough();
    if (w) return w.title;
    const meta = WALKTHROUGH_FILES.find((f) => f.roleKey === this.roleKey());
    return meta?.title ?? 'Guía';
  });

  readonly subtitle = computed(() => {
    const meta = WALKTHROUGH_FILES.find((f) => f.roleKey === this.roleKey());
    if (!meta) return '';
    return `Walkthrough E2E para ${meta.title}. Marca cada paso conforme lo verifiques.`;
  });

  readonly eyebrow = computed(() => `Guías E2E / ${this.title()}`);

  readonly completedCount = computed(() => {
    /*
     * Reading `progressService.progress()` here registers the signal as
     * a dependency. Without it, the computed only re-runs when the
     * walkthrough changes — toggling a checkbox would update the
     * signal but not this counter.
     */
    this.progressService.progress();
    const w = this.walkthrough();
    if (!w) return 0;
    let done = 0;
    for (const f of w.features) {
      for (const s of f.steps) {
        if (this.isStepDone(f, s)) done++;
      }
    }
    return done;
  });

  readonly totalCount = computed(() => {
    const w = this.walkthrough();
    if (!w) return 0;
    return w.features.reduce((acc, f) => acc + f.steps.length, 0);
  });

  readonly progressPercent = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });

  constructor() {
    /*
     * `roleKey` is an `input.required<string>()`. Reading it inside the
     * constructor throws NG0950 because Angular binds inputs *after*
     * construction. `effect()` is allowed to read inputs — it runs as
     * part of the change-detection cycle, after bindings settle.
     */
    effect(() => {
      const key = this.roleKey();
      if (key) {
        this.reload();
      }
    });
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.walkthroughService
      .load(this.roleKey() as RoleKey)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (w) => this.walkthrough.set(w),
        error: (err: unknown) => {
          this.loadError.set(this.formatError(err));
        },
      });
  }

  checkboxId(feature: WalkthroughFeature, step: WalkthroughStep): string {
    const cap = feature.capabilityId ?? feature.heading.replace(/\s+/g, '-').toLowerCase();
    return `wt-${cap}-${step.id}`;
  }

  isStepDone(feature: WalkthroughFeature, step: WalkthroughStep): boolean {
    /*
     * Read the progress signal here so callers that invoke us inside
     * a template binding register the dependency. Without it, OnPush
     * change detection wouldn't re-run when the user toggles a checkbox.
     */
    this.progressService.progress();
    if (!feature.capabilityId) return false;
    return this.progressService.isCompleted(feature.capabilityId, step.id);
  }

  featureDoneCount(feature: WalkthroughFeature): number {
    /*
     * Same dependency-tracking trick: read the signal so the parent
     * `@for` re-renders the "X / N pasos" badge when toggling.
     */
    this.progressService.progress();
    if (!feature.capabilityId || feature.steps.length === 0) return 0;
    return feature.steps.filter((s) => this.isStepDone(feature, s)).length;
  }

  onToggle(feature: WalkthroughFeature, step: WalkthroughStep): void {
    if (!feature.capabilityId) return;
    this.progressService.toggle(feature.capabilityId, step.id);
  }

  featureProgress(feature: WalkthroughFeature): string {
    return `${this.featureDoneCount(feature)} / ${feature.steps.length} pasos`;
  }

  hasAnyProgress(): boolean {
    return Object.keys(this.progressService.progress().completed).length > 0;
  }

  resetProgress(): void {
    if (!confirm('¿Borrar todo el progreso de las guías? Esta acción no se puede deshacer.')) {
      return;
    }
    this.progressService.resetAll();
  }

  private formatError(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return 'No se pudo cargar el archivo de la guía.';
  }
}
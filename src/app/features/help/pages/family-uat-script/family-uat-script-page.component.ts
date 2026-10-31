import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageContainerComponent, PageHeaderComponent, IconComponent } from '@shared/components';

import { familyUatScriptFor } from '../../family-uat/family-uat.catalog';
import { FamilyUatProgressService } from '../../family-uat/family-uat-progress.service';
import { FAMILY_UAT_BLOCK_LABEL } from '../../family-uat/family-uat.model';
import { isFamilyUatRoleKey } from '../../family-uat/family-uat.role-map';
import type { RoleKey } from '../../models/qa.model';

@Component({
  selector: 'app-family-uat-script-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageContainerComponent, PageHeaderComponent, IconComponent],
  template: `
    <app-page-container>
      @if (script(); as s) {
        <app-page-header
          eyebrow="Guía {{ s.code }}"
          [title]="s.title"
          [subtitle]="s.subtitle"
        >
          <a
            routerLink="/help"
            class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <app-icon name="arrow-left" [size]="14" />
            Todas las guías
          </a>
          <button
            type="button"
            (click)="copyBugTemplate()"
            class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            data-testid="family-uat-copy-bug"
          >
            <app-icon name="clipboard-list" [size]="14" />
            {{ copied() ? '¡Copiado!' : 'Copiar mensaje para WhatsApp' }}
          </button>
          <button
            type="button"
            (click)="resetProgress()"
            [disabled]="summary().done === 0"
            class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted disabled:opacity-50"
          >
            <app-icon name="rotate-ccw" [size]="14" />
            Empezar de cero
          </button>
        </app-page-header>

        <div class="mb-4 rounded-lg border border-border bg-surface-muted/30 px-4 py-3 text-sm text-content-subtle">
          <p>
            Marcá la casilla cuando el paso salga bien. El botón azul abre la pantalla en la app.
            Si algo falla, <span class="font-medium text-content">no sigas en silencio</span>: copiá el mensaje y avisá en el grupo.
          </p>
        </div>

        <div class="mb-6 flex flex-wrap items-center gap-3 text-sm text-content-subtle">
          <span class="font-medium text-content">
            Avance: {{ summary().done }} de {{ summary().total }}
          </span>
          <div class="h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted">
            <div
              class="h-full rounded-full bg-primary-500"
              [style.width.%]="summary().percent"
            ></div>
          </div>
          @if (copyError()) {
            <span class="text-danger">{{ copyError() }}</span>
          }
        </div>

        <div class="space-y-4">
          @for (block of s.blocks; track block.kind + block.title) {
            <section class="rounded-xl border border-border bg-surface-raised">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                (click)="toggleBlock(block.kind)"
                [attr.aria-expanded]="isOpen(block.kind)"
              >
                <span>
                  <span class="text-sm font-semibold text-content">{{ blockLabel(block.kind) }}</span>
                  <span class="ml-2 text-xs text-content-subtle">
                    {{ blockDone(s.roleKey, block) }} / {{ block.steps.length }}
                  </span>
                </span>
                <app-icon
                  [name]="isOpen(block.kind) ? 'chevron-up' : 'chevron-down'"
                  [size]="16"
                  class="text-content-subtle"
                />
              </button>

              @if (isOpen(block.kind)) {
                <ul class="divide-y divide-border-subtle border-t border-border-subtle">
                  @for (step of block.steps; track step.id) {
                    <li class="flex gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        class="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary-600 focus:ring-primary-500"
                        [checked]="progressSvc.isCompleted(s.roleKey, step.id)"
                        (change)="progressSvc.toggle(s.roleKey, step.id)"
                        [attr.aria-label]="'Marcar hecho: ' + step.title"
                      />
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="text-sm font-semibold text-content">{{ step.title }}</h3>
                          @if (step.route) {
                            <a
                              [routerLink]="step.route"
                              class="inline-flex items-center gap-1 rounded-md bg-primary-600/10 px-2 py-0.5 text-xs font-semibold text-primary-700 hover:bg-primary-600/20 dark:text-primary-300"
                              [attr.data-testid]="'family-uat-link-' + step.id"
                            >
                              {{ step.routeLabel || 'Abrir esta pantalla' }}
                              <app-icon name="arrow-right" [size]="12" />
                            </a>
                          }
                        </div>
                        <p class="mt-2 text-sm text-content">
                          <span class="font-semibold text-content-subtle">Qué hacer:</span>
                          {{ step.do }}
                        </p>
                        <p class="mt-1 text-sm text-content">
                          <span class="font-semibold text-content-subtle">Cómo saber que salió bien:</span>
                          {{ step.verify }}
                        </p>
                        @if (step.notify) {
                          <p class="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-content">
                            <span class="font-semibold">Avisá por WhatsApp:</span>
                            {{ step.notify }}
                          </p>
                        }
                        @if (step.note) {
                          <p class="mt-1 text-xs italic text-content-subtle">{{ step.note }}</p>
                        }
                      </div>
                    </li>
                  }
                </ul>
              }
            </section>
          }
        </div>
      } @else {
        <app-page-header
          eyebrow="Guía del colegio"
          title="No encontramos esa guía"
          subtitle="Elegí tu rol desde la lista de guías."
        >
          <a
            routerLink="/help"
            class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
          >
            Volver al inicio
          </a>
        </app-page-header>
      }
    </app-page-container>
  `,
})
export class FamilyUatScriptPageComponent {
  readonly progressSvc = inject(FamilyUatProgressService);

  readonly roleKey = input.required<string>();

  readonly copied = signal(false);
  readonly copyError = signal<string | null>(null);
  private readonly openBlocks = signal<Record<string, boolean>>({
    smoke: true,
    happy: true,
    reactive: false,
    negative: false,
  });

  private readonly progressSnap = this.progressSvc.progress;

  readonly script = computed(() => {
    const key = this.roleKey();
    if (!isFamilyUatRoleKey(key)) return undefined;
    return familyUatScriptFor(key);
  });

  readonly summary = computed(() => {
    this.progressSnap();
    const s = this.script();
    if (!s) return { done: 0, total: 0, percent: 0 };
    return this.progressSvc.summary(s);
  });

  blockLabel(kind: string): string {
    return FAMILY_UAT_BLOCK_LABEL[kind as keyof typeof FAMILY_UAT_BLOCK_LABEL] ?? kind;
  }

  isOpen(kind: string): boolean {
    return !!this.openBlocks()[kind];
  }

  toggleBlock(kind: string): void {
    this.openBlocks.update((m) => ({ ...m, [kind]: !m[kind] }));
  }

  blockDone(roleKey: RoleKey, block: { steps: readonly { id: string }[] }): number {
    this.progressSnap();
    return block.steps.filter((st) => this.progressSvc.isCompleted(roleKey, st.id)).length;
  }

  resetProgress(): void {
    const s = this.script();
    if (!s) return;
    this.progressSvc.resetRole(s.roleKey);
  }

  async copyBugTemplate(): Promise<void> {
    const s = this.script();
    if (!s) return;
    const text = [
      `Hola, soy ${s.bugRoleLabel} (${s.title})`,
      'Qué intenté hacer:',
      'En qué pantalla estaba (si la sabés):',
      'Pasos que di:',
      'Qué esperaba que pasara:',
      'Qué pasó en realidad:',
      'Qué tan grave: bloquea todo / molesto / detalle',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copyError.set(null);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copyError.set('No se pudo copiar. Escribí el mensaje a mano en el grupo.');
    }
  }
}

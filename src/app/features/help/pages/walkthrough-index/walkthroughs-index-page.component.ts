import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageContainerComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components';
import { IconComponent } from '@shared/components';

import { WALKTHROUGH_FILES } from '../../models/walkthrough.model';
import { WalkthroughProgressService } from '../../services/walkthrough-progress.service';

/**
 * Index of QA walkthrough guides — `/help/guides`.
 *
 * <p>One card per role. Each card shows the role's guide title and the
 * number of completed steps so the QA operator sees at a glance which
 * guides still have work pending.</p>
 */
@Component({
  selector: 'app-walkthroughs-index',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageContainerComponent, PageHeaderComponent, IconComponent],
  template: `
    <app-page-container>
      <app-page-header
        eyebrow="Guías E2E"
        title="Walkthroughs por rol"
        subtitle="Cada guía lista los pasos a verificar. Marca cada checkbox conforme completes la verificación."
      >
        <a
          routerLink="/help"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="arrow-left" [size]="14" />
          Centro de pruebas
        </a>
      </app-page-header>

      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (file of files; track file.roleKey) {
          <li>
            <a
              [routerLink]="['/help/guides', file.roleKey]"
              class="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition hover:border-primary hover:shadow"
              [attr.data-testid]="'walkthrough-card-' + file.roleKey"
            >
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold tracking-tight text-content">
                  {{ file.title }}
                </h2>
                <app-icon
                  name="arrow-right"
                  [size]="16"
                  class="text-content-subtle transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p class="mt-2 text-xs text-content-muted">
                Walkthrough E2E con pasos marcados.
              </p>
              <div class="mt-4 flex items-center justify-between text-2xs text-content-subtle">
                <span>{{ completedFor(file.roleKey) }} pasos marcados</span>
                <span class="font-mono">/{{ file.roleKey }}</span>
              </div>
            </a>
          </li>
        }
      </ul>

      <footer class="mt-10 border-t border-border-subtle pt-4 text-xs text-content-subtle">
        El progreso se guarda en este navegador (localStorage). Usa "Limpiar progreso"
        en cada guía para reiniciar el contador de un rol específico.
      </footer>
    </app-page-container>
  `,
})
export class WalkthroughsIndexPageComponent {
  private readonly progressService = inject(WalkthroughProgressService);

  readonly files = WALKTHROUGH_FILES;

  completedFor(roleKey: string): number {
    const all = this.progressService.progress().completed;
    // Count entries belonging to any capability whose id starts with the
    // role prefix (e.g. `sa.` for super-admin). This works because
    // capabilityIds in the catalog use `<roleKey>.<module>.<action>`.
    const prefix = this.rolePrefix(roleKey);
    if (!prefix) return 0;
    return Object.keys(all).filter((k) => k.startsWith(prefix)).length;
  }

  private rolePrefix(roleKey: string): string {
    const map: Record<string, string> = {
      'super-admin': 'sa.',
      'tenant-admin': 'ta.',
      teacher: 'te.',
      student: 'st.',
      parent: 'pa.',
      staff: 'sf.',
    };
    return map[roleKey] ?? '';
  }
}
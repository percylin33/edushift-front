import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageContainerComponent, PageHeaderComponent, IconComponent } from '@shared/components';

import { FAMILY_UAT_LEAD, FAMILY_UAT_SCRIPTS } from '../../family-uat/family-uat.catalog';

@Component({
  selector: 'app-family-uat-lead-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageContainerComponent, PageHeaderComponent, IconComponent],
  template: `
    <app-page-container>
      <app-page-header
        eyebrow="Solo organizador"
        [title]="lead.title"
        [subtitle]="lead.subtitle"
      >
        <a
          routerLink="/help"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="arrow-left" [size]="14" />
          Inicio de la guía
        </a>
        <a
          routerLink="/help/reports"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="alert-circle" [size]="14" />
          Lista de problemas
        </a>
      </app-page-header>

      <section class="mb-8">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-content-subtle">
          Abrir la guía de cada rol
        </h2>
        <div class="mt-3 flex flex-wrap gap-2">
          @for (s of scripts; track s.roleKey) {
            <a
              [routerLink]="['/help/script', s.roleKey]"
              class="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            >
              <span class="text-xs font-bold text-content-subtle">{{ s.code }}</span>
              {{ s.title }}
            </a>
          }
        </div>
      </section>

      <section class="mb-8 rounded-xl border border-border bg-surface-raised p-5">
        <h2 class="text-base font-semibold text-content">Antes del día (checklist)</h2>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-content">
          @for (item of lead.preflight; track item.id) {
            <li>
              <span class="font-medium">{{ item.title }}.</span>
              {{ item.detail }}
            </li>
          }
        </ol>
      </section>

      <section class="mb-8 rounded-xl border border-border bg-surface-raised p-5">
        <h2 class="text-base font-semibold text-content">Cadena en voz alta (todos juntos)</h2>
        <p class="mt-1 text-sm text-content-subtle">
          Pedí cada paso en orden. Así prueban juntos el flujo docente → alumno → padre → caja.
        </p>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-content">
          @for (item of lead.chain; track item.id) {
            <li>
              <span class="font-medium">{{ item.title }}.</span>
              {{ item.detail }}
            </li>
          }
        </ol>
      </section>

      <section class="rounded-xl border border-border bg-surface-raised p-5">
        <h2 class="text-base font-semibold text-content">¿Cuándo damos la prueba por buena?</h2>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-content">
          @for (item of lead.success; track item.id) {
            <li>
              <span class="font-medium">{{ item.title }}.</span>
              {{ item.detail }}
            </li>
          }
        </ul>
      </section>
    </app-page-container>
  `,
})
export class FamilyUatLeadPageComponent {
  readonly lead = FAMILY_UAT_LEAD;
  readonly scripts = FAMILY_UAT_SCRIPTS;
}

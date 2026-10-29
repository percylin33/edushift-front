import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { PageContainerComponent, PageHeaderComponent, IconComponent } from '@shared/components';
import { AuthService } from '@core/services';

import { FAMILY_UAT_SCRIPTS } from '../../family-uat/family-uat.catalog';
import { FamilyUatProgressService } from '../../family-uat/family-uat-progress.service';
import type { RoleKey } from '../../models/qa.model';
import {
  familyUatRoleTitle,
  userRolesToFamilyUatRoleKey,
} from '../../family-uat/family-uat.role-map';

/**
 * Landing de la guía familiar — textos pensados para personas no técnicas.
 */
@Component({
  selector: 'app-family-uat-hub-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageContainerComponent, PageHeaderComponent, IconComponent],
  template: `
    <app-page-container>
      <button
        type="button"
        class="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        (click)="goBack()"
      >
        <app-icon name="arrow-left" [size]="14" />
        Volver
      </button>
      <app-page-header
        eyebrow="Centro de pruebas"
        title="Guía de prueba del colegio"
        subtitle="Seguí los pasos de tu rol. Cada casilla es una acción concreta. El progreso se guarda en este celular o computadora."
      >
        <a
          routerLink="/help/reports"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="alert-circle" [size]="14" />
          Lista de problemas
        </a>
        <a
          routerLink="/help/lead"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="clipboard-check" [size]="14" />
          Solo organizador
        </a>
      </app-page-header>

      <section class="mb-8 rounded-xl border border-border bg-surface-muted/40 p-5 text-sm text-content">
        <h2 class="text-base font-semibold text-content">Cómo usar esta guía (2 minutos)</h2>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-content-subtle">
          <li>Tocá <span class="font-medium text-content">Abrir mi guía</span> (abajo). Solo hacé los pasos de <span class="font-medium text-content">tu</span> rol.</li>
          <li>En cada paso: leé “Qué hacer”, tocá el botón azul para abrir la pantalla, probá, y marcá la casilla si salió bien.</li>
          <li>Si algo falla: usá <span class="font-medium text-content">Copiar mensaje para WhatsApp</span> y pegalo en el grupo del organizador. No sigas en silencio.</li>
          <li>No hace falta saber de programación. Si una palabra no se entiende, preguntá al organizador.</li>
        </ol>
      </section>

      @if (myRoleKey(); as mine) {
        <section
          class="mb-8 rounded-xl border border-primary-500/30 bg-primary-500/5 p-5"
          data-testid="family-uat-my-role"
        >
          <p class="text-sm font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
            Te toca probar como
          </p>
          <h2 class="mt-1 text-xl font-bold text-content">{{ roleTitle(mine) }}</h2>
          <p class="mt-1 text-sm text-content-subtle">
            Empezá por la Parte 1 (abrir cada pantalla del menú) y después la Parte 2 (tu trabajo del día).
          </p>
          <a
            [routerLink]="['/help/script', mine]"
            class="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            data-testid="family-uat-open-mine"
          >
            Abrir mi guía
            <app-icon name="arrow-right" [size]="14" />
          </a>
        </section>
      } @else {
        <section class="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm">
          <p class="font-medium text-content">No detectamos tu rol automáticamente.</p>
          <p class="mt-1 text-content-subtle">
            Elegí abajo la tarjeta que te indicó el organizador (Docente, Estudiante, Padre, etc.).
          </p>
        </section>
      }

      <section>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-content-subtle">
          Todas las guías (por si el organizador te pide otra)
        </h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (card of roleCards(); track card.roleKey) {
            <a
              [routerLink]="['/help/script', card.roleKey]"
              class="group flex flex-col rounded-xl border border-border bg-surface-raised p-4 shadow-sm transition hover:border-primary-500/40 hover:shadow-md"
              [attr.data-testid]="'family-uat-card-' + card.roleKey"
              [class.ring-2]="card.roleKey === myRoleKey()"
              [class.ring-primary-500]="card.roleKey === myRoleKey()"
            >
              <div class="flex items-start justify-between gap-2">
                <span
                  class="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-surface-muted px-2 text-xs font-bold text-content"
                >
                  {{ card.code }}
                </span>
                <span class="text-xs font-medium text-content-subtle">{{ card.percent }}%</span>
              </div>
              <h3 class="mt-3 text-base font-semibold text-content group-hover:text-primary-700 dark:group-hover:text-primary-300">
                {{ card.title }}
              </h3>
              <p class="mt-1 flex-1 text-sm text-content-subtle">{{ card.subtitle }}</p>
              <p class="mt-3 text-xs text-content-subtle">
                {{ card.done }} de {{ card.total }} pasos hechos
              </p>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  class="h-full rounded-full bg-primary-500 transition-all"
                  [style.width.%]="card.percent"
                ></div>
              </div>
            </a>
          }
        </div>
      </section>

      <section class="mt-10 rounded-xl border border-dashed border-border p-5">
        <h2 class="text-base font-semibold text-content">Si algo no funciona</h2>
        <p class="mt-2 text-sm text-content-subtle">
          En tu guía hay un botón <span class="font-medium text-content">Copiar mensaje para WhatsApp</span>.
          Pegalo en el grupo y completá qué intentaste. No esperamos que sepas “códigos de error”.
        </p>
        <p class="mt-2 text-sm text-content-subtle">
          En esta prueba <span class="font-medium text-content">no</span> hace falta probar: pago Yape dentro de la app,
          SIAGIE, WhatsApp bot ni aplicaciones de celular aparte.
        </p>
      </section>
    </app-page-container>
  `,
})
export class FamilyUatHubPageComponent {
  private readonly auth = inject(AuthService);
  private readonly progress = inject(FamilyUatProgressService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  goBack(): void {
    const previous = this.router.lastSuccessfulNavigation()?.previousNavigation;
    if (previous) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl('/dashboard');
  }

  private readonly progressSnap = this.progress.progress;

  readonly myRoleKey = computed(() => userRolesToFamilyUatRoleKey(this.auth.roles()));

  readonly roleCards = computed(() => {
    this.progressSnap();
    return FAMILY_UAT_SCRIPTS.map((script) => {
      const { done, total, percent } = this.progress.summary(script);
      return {
        roleKey: script.roleKey,
        code: script.code,
        title: script.title,
        subtitle: script.subtitle,
        done,
        total,
        percent,
      };
    });
  });

  roleTitle(roleKey: RoleKey): string {
    return familyUatRoleTitle(roleKey);
  }
}

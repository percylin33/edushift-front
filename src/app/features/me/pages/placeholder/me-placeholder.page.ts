import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * DEBT-STUDENT-PRIVACY / Fase 1 — placeholder page used for every
 * sub-section whose real implementation lands in Fases 2-3 (Mis
 * cursos, Mis notas, Mi asistencia, Mi QR, Mis pagos).
 *
 * <p>Replaces the previous "no existe la ruta" fallback with an
 * in-app "próximamente" panel so the STUDENT doesn't see a 404 from
 * the router while the rollout is in progress. The card is rendered
 * with the same shell as the rest of the personal workspace so the
 * brand promise stays consistent.</p>
 *
 * <p>The page is intentionally routed through {@code permissionGuard}
 * (same as the family module), so it shows up only when the matching
 * {@code ME_*} permission is held by the caller.</p>
 */
@Component({
  selector: 'app-me-placeholder',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-12">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>

      <div class="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{{ title }}</h1>
        <p class="mt-3 text-slate-600 dark:text-slate-400">
          {{ description }}
        </p>
        <p class="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Esta sección forma parte del rollout del espacio personal del
          estudiante. Vuelve a consultar en las próximas semanas; te
          avisaremos cuando esté disponible.
        </p>
      </div>
    </section>
  `,
})
export class MePlaceholderPageComponent {
  @Input() title = 'Próximamente';
  @Input() description = 'Esta sección está en construcción.';
}

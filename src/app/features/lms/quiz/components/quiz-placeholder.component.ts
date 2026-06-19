import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '@shared/components';

/**
 * Placeholder genérico para las 4 rutas de Quiz (FE-7b.0).
 *
 * <p>FE-7b.0 entrega la infraestructura (RBAC, rutas, barrel, constantes);
 * los componentes reales de builder / player / results llegan en
 * FE-7b.1, FE-7b.2 y FE-7b.3 (ver {@code sprint-07b-lms-intelligence.md}).
 * Cada placeholder documenta:
 *
 * <ul>
 *   <li>El endpoint backend esperado (BE-7b.0 / BE-7b.1).</li>
 *   <li>La pantalla final que reemplazará este placeholder.</li>
 *   <li>Los permisos requeridos (espejo del {@code data.permissions} de la ruta).</li>
 * </ul>
 *
 * <p>El placeholder es intencionalmente simple: un card con icono + título +
 * descripción + chip de estado. El objetivo es que la navegación, el
 * {@code permissionGuard} y el lazy-loading de la feature Quiz estén
 * validados desde el primer commit, y que BE-7b.0 pueda entregar endpoints
 * sin esperar a que el FE esté completo.
 */
@Component({
  selector: 'app-quiz-placeholder',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body items-start gap-4">
        <div class="flex items-center gap-3">
          <div [class]="iconBgClass()">
            <app-icon [name]="icon()" [size]="22" />
          </div>
          <div>
            <h2 class="card-title text-lg">{{ title() }}</h2>
            <p class="text-sm opacity-70">{{ kicker() }}</p>
          </div>
        </div>
        <p class="text-sm leading-relaxed">
          {{ description() }}
        </p>
        <div class="card-actions">
          <div class="badge badge-outline gap-1">
            <app-icon name="clock" [size]="12" />
            Pendiente — Sprint 7b
          </div>
          <div class="badge badge-ghost gap-1">
            <app-icon name="info" [size]="12" />
            {{ permissionLabel() }}
          </div>
        </div>
      </div>
    </div>
  `
})
export class QuizPlaceholderComponent {
  /** Título principal del card. */
  readonly title = input.required<string>();
  /** Línea secundaria bajo el título (lo que el usuario está viendo). */
  readonly kicker = input.required<string>();
  /** Descripción larga del placeholder / spec de la pantalla final. */
  readonly description = input.required<string>();
  /** Icono del registry a mostrar. */
  readonly icon = input.required<IconName>();
  /** Permiso RBAC requerido (string legible). */
  readonly permissionLabel = input.required<string>();

  protected readonly iconBgClass = computed(() => 'rounded-md bg-indigo-50 text-indigo-700 p-2');
}

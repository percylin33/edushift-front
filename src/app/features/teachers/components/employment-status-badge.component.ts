import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmploymentStatus } from '@core/enums';
import { EMPLOYMENT_STATUS_LABELS } from '../models';

/**
 * Chip visual para el estado laboral del docente. Mismo patrón que
 * {@code EnrollmentStatusBadgeComponent}: un único {@code <span>} con
 * clases compuestas según {@link EmploymentStatus}.
 *
 * <p>Las paletas usan tokens semánticos del design system para que
 * dark mode y theming funcionen sin overrides:</p>
 * <ul>
 *   <li>{@link EmploymentStatus#Active}    → success.</li>
 *   <li>{@link EmploymentStatus#OnLeave}   → warning.</li>
 *   <li>{@link EmploymentStatus#Suspended} → danger.</li>
 *   <li>{@link EmploymentStatus#Resigned}, {@link EmploymentStatus#Retired} →
 *       neutral (terminal-ish; ni alarma ni acción pendiente).</li>
 * </ul>
 */
@Component({
  selector: 'app-employment-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="cssClass()" [attr.title]="title()">
      <span
        class="mr-1.5 h-1.5 w-1.5 rounded-full"
        [class]="dotClass()"
      ></span>
      {{ label() }}
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .badge {
        display: inline-flex;
        align-items: center;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0.2rem 0.55rem;
        border-radius: 9999px;
        border: 1px solid transparent;
      }
      .badge--active   { background: rgb(220 252 231); color: rgb(22 101 52);   border-color: rgb(187 247 208); }
      .badge--leave    { background: rgb(254 249 195); color: rgb(133 77 14);   border-color: rgb(253 224 71); }
      .badge--suspend  { background: rgb(254 226 226); color: rgb(153 27 27);   border-color: rgb(252 165 165); }
      .badge--terminal { background: rgb(243 244 246); color: rgb(55 65 81);    border-color: rgb(229 231 235); }

      .dot--active   { background: rgb(34 197 94); }
      .dot--leave    { background: rgb(234 179 8); }
      .dot--suspend  { background: rgb(220 38 38); }
      .dot--terminal { background: rgb(107 114 128); }

      :host-context(.dark) .badge--active   { background: rgba(34 197 94 / 0.15);  color: rgb(187 247 208); border-color: rgba(34 197 94 / 0.3); }
      :host-context(.dark) .badge--leave    { background: rgba(234 179 8 / 0.15);  color: rgb(253 224 71); border-color: rgba(234 179 8 / 0.3); }
      :host-context(.dark) .badge--suspend  { background: rgba(220 38 38 / 0.18);  color: rgb(252 165 165); border-color: rgba(220 38 38 / 0.3); }
      :host-context(.dark) .badge--terminal { background: rgba(75 85 99 / 0.4);    color: rgb(209 213 219); border-color: rgba(107 114 128 / 0.4); }
    `
  ]
})
export class EmploymentStatusBadgeComponent {
  readonly status = input.required<EmploymentStatus>();

  protected readonly label = computed(() => EMPLOYMENT_STATUS_LABELS[this.status()]);

  protected readonly cssClass = computed(() => {
    switch (this.status()) {
      case EmploymentStatus.Active:    return 'badge--active';
      case EmploymentStatus.OnLeave:   return 'badge--leave';
      case EmploymentStatus.Suspended: return 'badge--suspend';
      case EmploymentStatus.Resigned:
      case EmploymentStatus.Retired:   return 'badge--terminal';
    }
  });

  protected readonly dotClass = computed(() => {
    switch (this.status()) {
      case EmploymentStatus.Active:    return 'dot--active';
      case EmploymentStatus.OnLeave:   return 'dot--leave';
      case EmploymentStatus.Suspended: return 'dot--suspend';
      case EmploymentStatus.Resigned:
      case EmploymentStatus.Retired:   return 'dot--terminal';
    }
  });

  protected readonly title = computed(() => {
    switch (this.status()) {
      case EmploymentStatus.Active:    return 'Docente activo, asignable a secciones';
      case EmploymentStatus.OnLeave:   return 'En licencia temporal';
      case EmploymentStatus.Suspended: return 'Suspendido — no puede iniciar sesión';
      case EmploymentStatus.Resigned:  return 'Renunció';
      case EmploymentStatus.Retired:   return 'Jubilado';
    }
  });
}

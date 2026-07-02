import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components';
import { RubricRow } from '../models';
import { RubricSystemBadgeComponent } from './rubric-system-badge.component';

/**
 * Card resumen de una {@link RubricRow}. Pensada para grids de 2-3
 * columnas con CSS grid, no para listings densos. Acciones contextuales
 * por lifecycle (system → solo Fork; personalizada → Editar / Fork /
 * Eliminar).
 */
@Component({
  selector: 'app-rubric-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, RubricSystemBadgeComponent],
  template: `
    <article
      class="card flex flex-col transition-shadow hover:shadow-md"
      [class.opacity-60]="!rubric().isActive"
    >
      <header class="card-header flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h3 class="card-title truncate" [title]="rubric().name">
            {{ rubric().name }}
          </h3>
          <div class="mt-1 flex items-center gap-2">
            <app-rubric-system-badge
              [isSystem]="rubric().isSystem"
              [parentPublicUuid]="rubric().parentRubricPublicUuid"
            />
            <span class="text-xs text-content-muted">
              {{ rubric().criterionCount }}
              {{ rubric().criterionCount === 1 ? 'criterio' : 'criterios' }}
            </span>
          </div>
        </div>
      </header>

      <div class="card-body flex-1">
        @if (rubric().description) {
          <p class="line-clamp-3 text-sm text-content-muted">
            {{ rubric().description }}
          </p>
        } @else {
          <p class="text-sm italic text-content-muted">Sin descripción.</p>
        }

        @if (rubric().criterionSummary.length > 0) {
          <ul class="mt-3 space-y-1">
            @for (item of rubric().criterionSummary; track item) {
              <li class="truncate text-xs text-content-muted">• {{ item }}</li>
            }
          </ul>
        }
      </div>

      <footer
        class="flex flex-wrap items-center justify-end gap-1 border-t border-border-subtle px-5 py-3"
      >
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          title="Ver detalle"
          (click)="view.emit(rubric().publicUuid)"
        >
          <app-icon name="eye" [size]="14" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          title="Forkear y editar"
          (click)="fork.emit(rubric().publicUuid)"
        >
          <app-icon name="layers" [size]="14" />
          <span>Fork</span>
        </button>
        @if (!rubric().isSystem) {
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            title="Editar"
            (click)="edit.emit(rubric().publicUuid)"
          >
            <app-icon name="pencil" [size]="14" />
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50"
            title="Eliminar"
            (click)="remove.emit(rubric().publicUuid)"
          >
            <app-icon name="trash-2" [size]="14" />
          </button>
        }
      </footer>
    </article>
  `,
})
export class RubricCardComponent {
  readonly rubric = input.required<RubricRow>();

  readonly view = output<string>();
  readonly edit = output<string>();
  readonly fork = output<string>();
  readonly remove = output<string>();
}

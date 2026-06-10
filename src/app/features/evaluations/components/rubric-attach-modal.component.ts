import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import {
  RubricSystemBadgeComponent
} from '@features/rubrics/components/rubric-system-badge.component';
import { RubricsApiService } from '@features/rubrics/services/rubrics-api.service';
import { RubricRow } from '@features/rubrics/models';
import { firstValueFrom } from 'rxjs';

/**
 * Modal de selección de rúbrica para vincular a una evaluation
 * (FE-5B.5).
 *
 * <p>Carga el listing de rúbricas activas del tenant y permite
 * filtrar inline por nombre. Excluye `excludeUuid` (por defecto, la
 * rúbrica actualmente vinculada — para que en el modo "reemplazar"
 * el usuario no se equivoque de origen).</p>
 */
@Component({
  selector: 'app-rubric-attach-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IconComponent,
    SpinnerComponent,
    RubricSystemBadgeComponent
  ],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rubric-attach-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="rubric-attach-title" class="card-title">
              {{ replacing() ? 'Reemplazar rúbrica' : 'Vincular rúbrica' }}
            </h2>
            <p class="card-description">
              Elige una rúbrica del tenant. Si necesitas adaptarla,
              forkéala desde el catálogo y luego vincula el clon.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            aria-label="Cerrar"
            (click)="cancel()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="card-body flex-1 overflow-y-auto">
          <div class="field mb-4">
            <input
              type="text"
              class="input"
              [value]="searchTerm()"
              (input)="onSearch($any($event.target).value)"
              placeholder="Buscar por nombre…"
              autofocus
            />
          </div>

          @if (loading()) {
            <div class="flex items-center justify-center py-10">
              <app-spinner [size]="20" label="Cargando rúbricas…" />
            </div>
          } @else if (errorMessage()) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ errorMessage() }}</p>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                (click)="reload()"
              >
                Reintentar
              </button>
            </div>
          } @else if (filteredRows().length === 0) {
            <div class="text-center py-8 text-content-muted text-sm">
              No hay rúbricas que coincidan. Crea una desde
              <strong>/rubrics</strong> o ajusta la búsqueda.
            </div>
          } @else {
            <ul class="grid gap-2">
              @for (row of filteredRows(); track row.publicUuid) {
                <li>
                  <button
                    type="button"
                    class="w-full text-left rounded-md border border-border-subtle p-3 hover:bg-surface-subtle transition-colors flex items-start gap-3"
                    [disabled]="saving()"
                    (click)="onSelect(row)"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <p class="font-medium truncate">{{ row.name }}</p>
                        <app-rubric-system-badge
                          [isSystem]="row.isSystem"
                          [parentPublicUuid]="row.parentRubricPublicUuid"
                        />
                      </div>
                      @if (row.description) {
                        <p class="text-xs text-content-muted line-clamp-2">
                          {{ row.description }}
                        </p>
                      }
                      <p class="text-xs text-content-muted mt-1">
                        {{ row.criterionCount }}
                        {{ row.criterionCount === 1 ? 'criterio' : 'criterios' }}
                      </p>
                    </div>
                    <app-icon name="chevron-right" [size]="16" />
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <footer class="px-5 py-3 border-t border-border-subtle flex justify-end">
          <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  `
})
export class RubricAttachModalComponent implements OnInit {
  private readonly rubricsApi = inject(RubricsApiService);

  /** UUID de una rúbrica a excluir (típicamente la ya vinculada). */
  readonly excludeUuid = input<string | undefined>(undefined);
  /** Indica si el flujo es "reemplazar" (vs vincular por primera vez). */
  readonly replacing = input<boolean>(false);
  /** Bloquea el botón de selección durante el upsert. */
  readonly saving = input<boolean>(false);

  readonly closed = output<void>();
  readonly selected = output<string>();

  protected readonly rows = signal<RubricRow[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchTerm = signal<string>('');

  protected readonly filteredRows = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const exclude = this.excludeUuid();
    return this.rows().filter((r) => {
      if (exclude && r.publicUuid === exclude) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false)
      );
    });
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const rows = await firstValueFrom(
        this.rubricsApi.listRubrics({ isActive: true })
      );
      this.rows.set(rows);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'No pudimos cargar las rúbricas.'
      );
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(value: string): void {
    this.searchTerm.set(value ?? '');
  }

  protected onSelect(row: RubricRow): void {
    this.selected.emit(row.publicUuid);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  protected cancel(): void {
    this.closed.emit();
  }
}

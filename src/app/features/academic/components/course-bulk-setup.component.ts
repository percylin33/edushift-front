import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicStore } from '../store';
import { CreateCourseRequest } from '../models';
import {
  PERU_COURSE_CATALOG,
  PeruCourseCatalogItem,
} from '../utils/peru-course-catalog';

interface CatalogRowState {
  item: PeruCourseCatalogItem;
  /** Level publicUuids elegidos para este curso. */
  levelUuids: string[];
  selected: boolean;
  alreadyExists: boolean;
}

/**
 * Panel de setup masivo: lista de cursos usuales en Perú con checks de
 * nivel y creación vía {@link AcademicStore#createCoursesBulk}.
 */
@Component({
  selector: 'app-course-bulk-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, SpinnerComponent],
  template: `
    <section
      class="card mb-4 w-full"
      [class.ml-auto]="compactCollapsed()"
      [class.max-w-md]="compactCollapsed()"
    >
      <header
        class="card-header flex flex-wrap items-center justify-between gap-3"
        [class.items-start]="expanded()"
      >
        <div class="min-w-0">
          <h3
            class="card-title"
            [class.text-base]="expanded() || !alreadyConfigured()"
            [class.text-sm]="compactCollapsed()"
          >
            Cursos usuales (Perú)
          </h3>
          @if (expanded()) {
            <p class="card-description">
              Selecciona los cursos del currículo nacional que dicta tu colegio y los niveles en los
              que aplican.
            </p>
          }
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm shrink-0"
          (click)="expanded.set(!expanded())"
          [attr.aria-expanded]="expanded()"
        >
          <app-icon [name]="expanded() ? 'chevron-up' : 'chevron-down'" [size]="16" />
          {{ expanded() ? 'Ocultar' : 'Mostrar' }}
        </button>
      </header>

      @if (expanded()) {
        <div class="card-body space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-ghost btn-sm" (click)="selectAllMissing()">
                Seleccionar faltantes
              </button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="clearSelection()">
                Limpiar selección
              </button>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="!canSubmit()"
              (click)="submit()"
            >
              @if (busy()) {
                <app-spinner [size]="14" label="Creando" />
              } @else {
                <app-icon name="sparkles" [size]="16" />
              }
              Crear cursos seleccionados
              @if (pendingCount() > 0) {
                <span class="badge badge-neutral ml-1">{{ pendingCount() }}</span>
              }
            </button>
          </div>

          @if (bulkProgress(); as bp) {
            <div class="alert alert-info">
              <app-spinner [size]="16" label="Generando" />
              <p class="flex-1 text-sm">
                Creando cursos…
                <span class="font-medium">{{ bp.current }} / {{ bp.total }}</span>
              </p>
            </div>
          }

          @if (resultMessage(); as msg) {
            <div
              class="alert"
              [class.alert-success]="!resultIsError()"
              [class.alert-danger]="resultIsError()"
            >
              <app-icon [name]="resultIsError() ? 'alert-circle' : 'check'" [size]="16" />
              <p class="flex-1 text-sm">{{ msg }}</p>
              <button type="button" class="btn btn-ghost btn-sm" (click)="resultMessage.set(null)">
                Cerrar
              </button>
            </div>
          }

          @if (levels().length === 0) {
            <p class="text-sm text-content-muted">
              No hay niveles. Crea INICIAL / PRIMARIA / SECUNDARIA antes de sembrar cursos.
            </p>
          } @else {
            <div class="overflow-x-auto rounded-lg border border-border">
              <table class="table">
                <thead>
                  <tr>
                    <th class="w-12" aria-label="Seleccionar"></th>
                    <th class="min-w-[90px]">Código</th>
                    <th class="min-w-[180px]">Nombre</th>
                    <th>Niveles</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.item.code; let i = $index) {
                    <tr [class.opacity-60]="row.alreadyExists">
                      <td>
                        <input
                          type="checkbox"
                          class="checkbox"
                          [checked]="row.selected || row.alreadyExists"
                          [disabled]="row.alreadyExists || busy()"
                          (change)="toggleSelected(i, $event)"
                          [attr.aria-label]="'Incluir ' + row.item.name"
                        />
                      </td>
                      <td>
                        <span class="font-mono text-xs font-semibold uppercase">{{
                          row.item.code
                        }}</span>
                        @if (row.alreadyExists) {
                          <span class="ml-2 text-[10px] text-content-muted">Ya creado</span>
                        }
                      </td>
                      <td class="font-medium text-content">{{ row.item.name }}</td>
                      <td>
                        <div class="flex flex-wrap gap-2">
                          @for (lv of levels(); track lv.publicUuid) {
                            <label
                              class="inline-flex items-center gap-1.5 text-xs"
                              [class.text-content-muted]="row.alreadyExists"
                            >
                              <input
                                type="checkbox"
                                class="checkbox"
                                [checked]="row.levelUuids.includes(lv.publicUuid)"
                                [disabled]="row.alreadyExists || busy() || !row.selected"
                                (change)="toggleLevel(i, lv.publicUuid, $event)"
                              />
                              {{ lv.code }}
                            </label>
                          }
                        </div>
                        @if (row.selected && !row.alreadyExists && row.levelUuids.length === 0) {
                          <p class="mt-1 text-[11px] text-danger-600">Elige al menos un nivel.</p>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class CourseBulkSetupComponent implements OnInit {
  private readonly store = inject(AcademicStore);

  readonly completed = output<void>();

  protected readonly levels = this.store.levels;
  protected readonly bulkProgress = this.store.bulkProgress;

  protected readonly expanded = signal(false);
  protected readonly rows = signal<CatalogRowState[]>([]);
  protected readonly busy = signal(false);
  protected readonly resultMessage = signal<string | null>(null);
  protected readonly resultIsError = signal(false);

  private readonly existingCodes = computed(() => {
    const codes = new Set<string>();
    for (const c of this.store.courses()) {
      codes.add(c.code.trim().toUpperCase());
    }
    return codes;
  });

  /** Tras el primer uso (algún curso del catálogo existe): chip compacto a la derecha si está cerrado. */
  protected readonly alreadyConfigured = computed(() => {
    const existing = this.existingCodes();
    return PERU_COURSE_CATALOG.some((item) => existing.has(item.code.toUpperCase()));
  });

  /** Compacto solo cerrado; al expandir ocupa todo el ancho. */
  protected readonly compactCollapsed = computed(
    () => this.alreadyConfigured() && !this.expanded(),
  );

  protected readonly pendingCount = computed(() =>
    this.rows().filter((r) => r.selected && !r.alreadyExists && r.levelUuids.length > 0).length,
  );

  protected readonly canSubmit = computed(
    () => this.pendingCount() > 0 && !this.busy() && !this.bulkProgress(),
  );

  ngOnInit(): void {
    this.rebuildRows();
    this.syncExpandedForMode();
  }

  /** Re-sincroniza flags {@code alreadyExists} tras un reload del store. */
  refreshPresence(): void {
    const existing = this.existingCodes();
    this.rows.update((list) =>
      list.map((r) => {
        const alreadyExists = existing.has(r.item.code.toUpperCase());
        return {
          ...r,
          alreadyExists,
          selected: alreadyExists ? false : r.selected,
        };
      }),
    );
    this.syncExpandedForMode();
  }

  protected selectAllMissing(): void {
    this.rows.update((list) =>
      list.map((r) => (r.alreadyExists ? r : { ...r, selected: true })),
    );
  }

  protected clearSelection(): void {
    this.rows.update((list) =>
      list.map((r) => (r.alreadyExists ? r : { ...r, selected: false })),
    );
  }

  protected toggleSelected(index: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.rows.update((list) =>
      list.map((r, i) => (i === index && !r.alreadyExists ? { ...r, selected: checked } : r)),
    );
  }

  protected toggleLevel(index: number, levelUuid: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.rows.update((list) =>
      list.map((r, i) => {
        if (i !== index || r.alreadyExists) return r;
        const set = new Set(r.levelUuids);
        if (checked) set.add(levelUuid);
        else set.delete(levelUuid);
        return { ...r, levelUuids: [...set] };
      }),
    );
  }

  protected async submit(): Promise<void> {
    const items: CreateCourseRequest[] = this.rows()
      .filter((r) => r.selected && !r.alreadyExists && r.levelUuids.length > 0)
      .map((r) => ({
        code: r.item.code,
        name: r.item.name,
        isActive: true,
        levelPublicUuids: r.levelUuids,
      }));

    if (items.length === 0) return;

    this.busy.set(true);
    this.resultMessage.set(null);
    this.resultIsError.set(false);

    try {
      const result = await this.store.createCoursesBulk(items);
      if (result.failedAt != null) {
        this.resultIsError.set(true);
        this.resultMessage.set(
          `Se detuvo en el curso ${result.failedAt}. Creados: ${result.created}. Omitidos: ${result.skipped}. ${this.store.error() ?? ''}`.trim(),
        );
      } else {
        this.resultIsError.set(false);
        this.resultMessage.set(
          `Listo: ${result.created} creados` +
            (result.skipped > 0 ? `, ${result.skipped} ya existían` : '') +
            '.',
        );
        this.refreshPresence();
        this.completed.emit();
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Siempre cerrado al montar / tras crear. */
  private syncExpandedForMode(): void {
    this.expanded.set(false);
  }

  private rebuildRows(): void {
    const byCode = new Map(this.levels().map((l) => [l.code.toUpperCase(), l.publicUuid]));
    const existing = this.existingCodes();

    this.rows.set(
      PERU_COURSE_CATALOG.map((item) => {
        const levelUuids = item.levelCodes
          .map((code) => byCode.get(code.toUpperCase()))
          .filter((uuid): uuid is string => !!uuid);
        const alreadyExists = existing.has(item.code.toUpperCase());
        return {
          item,
          levelUuids,
          selected: !alreadyExists && levelUuids.length > 0,
          alreadyExists,
        };
      }),
    );
  }
}

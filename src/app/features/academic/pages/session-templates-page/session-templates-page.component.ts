import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  SESSION_TEMPLATE_FAMILY_LABELS,
  SessionTemplateDetail,
  SessionTemplateFamily,
  SessionTemplateGroup,
  SessionTemplateListItem,
} from '../../models/session-template.model';
import { SessionTemplatesApiService } from '../../services/session-templates-api.service';

type FamilyFilter = 'ALL' | SessionTemplateFamily;

type PhaseDraft = {
  id: string;
  name: string;
  durationMin: number | null;
  description: string;
};

type PreviewPhase = {
  name: string;
  durationMin: number | null;
  description: string;
};

type CatalogPreviewState = {
  listItem: SessionTemplateListItem;
  phases: PreviewPhase[];
  activityTypes: string[];
  evaluationMethods: string[];
  materials: string[];
  totalMinutes: number;
};

const DEFAULT_PHASES: Omit<PhaseDraft, 'id'>[] = [
  { name: 'Inicio', durationMin: 15, description: 'Motivación y saberes previos' },
  { name: 'Desarrollo', durationMin: 45, description: 'Construcción del aprendizaje' },
  { name: 'Cierre', durationMin: 15, description: 'Metacognición y síntesis' },
];

const MOCK_SESSION_TITLE = 'Los seres vivos del entorno';

/**
 * `/academic/session-templates` — estándar MINEDU + plantillas del colegio.
 */
@Component({
  selector: 'app-session-templates-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent, SpinnerComponent, EmptyStateComponent],
  template: `
    <div class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Académico</p>
          <h1 class="text-2xl font-semibold text-slate-900">Plantillas de sesión</h1>
          <p class="mt-1 max-w-2xl text-sm text-slate-600">
            Plantilla estándar MINEDU y las que cree el colegio.
          </p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
          <app-icon name="plus" [size]="16" />
          Nueva plantilla
        </button>
      </header>

      <div class="flex flex-wrap items-center gap-3">
        <label class="field max-w-xs flex-1">
          <span class="sr-only">Buscar</span>
          <input
            class="input"
            type="search"
            placeholder="Buscar por nombre…"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
        </label>
        <div class="flex flex-wrap gap-2">
          @for (f of familyFilters(); track f) {
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="familyFilter() === f"
              [class.btn-ghost]="familyFilter() !== f"
              (click)="familyFilter.set(f)"
            >
              {{ familyFilterLabel(f) }}
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-16">
          <app-spinner [size]="28" label="Cargando plantillas…" />
        </div>
      } @else if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {{ error() }}
        </div>
      } @else if (filteredGroups().length === 0) {
        <app-empty-state
          title="Sin plantillas"
          description="Crea una plantilla del colegio o usa la estándar MINEDU."
        />
      } @else {
        @for (group of filteredGroups(); track group.family) {
          <section class="space-y-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {{ group.labelEs }}
            </h2>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              @for (t of group.templates; track t.publicUuid) {
                <article class="card flex flex-col gap-3 p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h3 class="font-semibold text-slate-900">{{ t.name }}</h3>
                      <p class="mt-0.5 text-xs text-slate-500">{{ t.templateKey }}</p>
                    </div>
                    <div class="flex flex-wrap justify-end gap-1">
                      @if (t.isSystem) {
                        <span class="badge badge-neutral">Sistema</span>
                      } @else {
                        <span class="badge badge-primary">Colegio</span>
                      }
                      @if (t.isDefault) {
                        <span class="badge badge-success">Predeterminada</span>
                      }
                    </div>
                  </div>
                  @if (t.description) {
                    <p class="text-sm text-slate-600">{{ t.description }}</p>
                  }
                  <div class="flex flex-wrap gap-1.5">
                    @for (p of t.phasesPreview; track p.name) {
                      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {{ p.name }}
                        @if (p.durationMin) {
                          <span class="text-slate-400"> · {{ p.durationMin }}′</span>
                        }
                      </span>
                    }
                  </div>
                  <div class="mt-auto flex flex-wrap gap-2 pt-1">
                    @if (t.canAdopt || t.phasesPreview.length) {
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        [disabled]="previewLoading() === t.publicUuid"
                        (click)="openPreview(t)"
                      >
                        @if (previewLoading() === t.publicUuid) {
                          Ver ejemplo…
                        } @else {
                          Ver ejemplo
                        }
                      </button>
                    }
                    @if (t.canAdopt) {
                      <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        [disabled]="busyUuid() === t.publicUuid"
                        (click)="adopt(t, false)"
                      >
                        Adoptar
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        [disabled]="busyUuid() === t.publicUuid"
                        (click)="adopt(t, true)"
                      >
                        Adoptar y predeterminar
                      </button>
                    }
                    @if (t.canEdit) {
                      <button type="button" class="btn btn-ghost btn-sm" (click)="openEdit(t)">
                        Editar
                      </button>
                      @if (!t.isDefault) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm"
                          [disabled]="busyUuid() === t.publicUuid"
                          (click)="setDefault(t)"
                        >
                          Predeterminar
                        </button>
                      }
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-red-600"
                        [disabled]="busyUuid() === t.publicUuid"
                        (click)="remove(t)"
                      >
                        Eliminar
                      </button>
                    }
                  </div>
                </article>
              }
            </div>
          </section>
        }
      }

      @if (preview(); as p) {
        <div
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
          role="presentation"
          (click)="closePreview()"
        >
          <div
            class="card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-template-preview-title"
            (click)="$event.stopPropagation()"
          >
            <header
              class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"
            >
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vista previa
                </p>
                <h2
                  id="session-template-preview-title"
                  class="mt-0.5 text-lg font-semibold text-slate-900"
                >
                  {{ p.listItem.name }}
                </h2>
                <p class="mt-1 text-sm text-slate-600">
                  {{
                    p.listItem.description ||
                      'Así se vería la estructura de una sesión con esta plantilla.'
                  }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span class="badge badge-neutral">{{ p.listItem.familyLabel }}</span>
                  @if (p.listItem.isSystem) {
                    <span class="badge badge-neutral">Catálogo MINEDU</span>
                  }
                  <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                    {{ p.totalMinutes }} min · {{ p.phases.length }}
                    {{ p.phases.length === 1 ? 'fase' : 'fases' }}
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm shrink-0"
                aria-label="Cerrar"
                (click)="closePreview()"
              >
                <app-icon name="x" [size]="16" />
              </button>
            </header>

            <div class="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              <section aria-labelledby="st-preview-phases">
                <h3
                  id="st-preview-phases"
                  class="mb-3 text-sm font-semibold text-slate-900"
                >
                  Momentos de la clase
                </h3>
                @if (p.phases.length === 0) {
                  <p class="text-sm text-slate-500">Esta plantilla no define fases.</p>
                } @else {
                  <ol class="relative space-y-0 border-l-2 border-slate-200 pl-4">
                    @for (phase of p.phases; track phase.name + $index; let i = $index) {
                      <li class="relative pb-5 last:pb-0">
                        <span
                          class="absolute -left-[1.35rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-white"
                          aria-hidden="true"
                          >{{ i + 1 }}</span
                        >
                        <div class="flex flex-wrap items-baseline justify-between gap-2">
                          <p class="font-medium text-slate-900">{{ phase.name }}</p>
                          @if (phase.durationMin) {
                            <span class="text-xs tabular-nums text-slate-500"
                              >{{ phase.durationMin }} min</span
                            >
                          }
                        </div>
                        @if (phase.description) {
                          <p class="mt-0.5 text-sm text-slate-600">{{ phase.description }}</p>
                        }
                      </li>
                    }
                  </ol>
                }
              </section>

              <section aria-labelledby="st-preview-example">
                <h3
                  id="st-preview-example"
                  class="mb-2 text-sm font-semibold text-slate-900"
                >
                  Ejemplo de sesión
                </h3>
                <p class="mb-3 text-xs text-slate-500">
                  Datos de muestra: así se llenaría al crear una sesión con esta
                  plantilla.
                </p>
                <div class="overflow-hidden rounded-lg border border-slate-200">
                  <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Título (ejemplo)
                    </p>
                    <p class="font-semibold text-slate-900">{{ mockSessionTitle }}</p>
                    <p class="mt-1 text-xs text-slate-500">
                      Duración sugerida: {{ p.totalMinutes || '—' }} minutos
                    </p>
                  </div>
                  <ul class="divide-y divide-slate-100">
                    @for (phase of p.phases; track 'ex-' + phase.name + $index) {
                      <li class="px-4 py-3">
                        <p class="text-sm font-medium text-slate-800">
                          [{{ phase.name }}]
                          {{ exampleActivityLabel(phase.name) }}
                        </p>
                        <p class="mt-0.5 text-xs text-slate-500">
                          {{ phase.durationMin ?? 15 }} min
                          @if (phase.description) {
                            · {{ phase.description }}
                          }
                        </p>
                      </li>
                    }
                  </ul>
                </div>
              </section>

              @if (p.activityTypes.length || p.evaluationMethods.length || p.materials.length) {
                <section class="grid gap-4 sm:grid-cols-3" aria-label="Sugerencias de la plantilla">
                  @if (p.activityTypes.length) {
                    <div>
                      <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tipos de actividad
                      </h4>
                      <div class="flex flex-wrap gap-1.5">
                        @for (a of p.activityTypes; track a) {
                          <span
                            class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >{{ humanizeToken(a) }}</span
                          >
                        }
                      </div>
                    </div>
                  }
                  @if (p.evaluationMethods.length) {
                    <div>
                      <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Evaluación
                      </h4>
                      <div class="flex flex-wrap gap-1.5">
                        @for (e of p.evaluationMethods; track e) {
                          <span
                            class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >{{ humanizeToken(e) }}</span
                          >
                        }
                      </div>
                    </div>
                  }
                  @if (p.materials.length) {
                    <div>
                      <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Materiales
                      </h4>
                      <div class="flex flex-wrap gap-1.5">
                        @for (m of p.materials; track m) {
                          <span
                            class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >{{ humanizeToken(m) }}</span
                          >
                        }
                      </div>
                    </div>
                  }
                </section>
              }
            </div>

            <footer
              class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3"
            >
              <button type="button" class="btn btn-ghost btn-sm" (click)="closePreview()">
                Cerrar
              </button>
              @if (p.listItem.canAdopt) {
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  [disabled]="busyUuid() === p.listItem.publicUuid"
                  (click)="adoptFromPreview(false)"
                >
                  Adoptar
                </button>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="busyUuid() === p.listItem.publicUuid"
                  (click)="adoptFromPreview(true)"
                >
                  Adoptar y predeterminar
                </button>
              }
            </footer>
          </div>
        </div>
      }

      @if (editorOpen()) {
        <div
          class="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-template-editor-title"
          (click)="closeEditor()"
        >
          <div
            class="card flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden shadow-xl"
            (click)="$event.stopPropagation()"
          >
            <header
              class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"
            >
              <div class="min-w-0">
                <h2
                  id="session-template-editor-title"
                  class="text-lg font-semibold text-slate-900"
                >
                  {{ editingUuid() ? 'Editar plantilla' : 'Nueva plantilla del colegio' }}
                </h2>
                <p class="mt-1 text-sm text-slate-600">
                  Define cómo se organiza una clase: un nombre y los momentos
                  (fases) que usarán los docentes y la IA.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm shrink-0"
                aria-label="Cerrar"
                (click)="closeEditor()"
              >
                <app-icon name="x" [size]="16" />
              </button>
            </header>

            <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section class="space-y-3">
                <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Datos generales
                </h3>
                <label class="field">
                  <span class="label">Nombre visible</span>
                  <input
                    class="input"
                    [(ngModel)]="draftName"
                    (ngModelChange)="onNameChange($event)"
                    placeholder="Ej. Sesión estándar 75 min"
                    maxlength="200"
                    autocomplete="off"
                  />
                  <span class="mt-1 block text-xs text-slate-500">
                    Así la verán los docentes al crear una sesión.
                  </span>
                </label>
                <label class="field">
                  <span class="label"
                    >Descripción
                    <span class="font-normal text-slate-400">(opcional)</span></span
                  >
                  <textarea
                    class="input min-h-[64px]"
                    [(ngModel)]="draftDescription"
                    placeholder="Para qué sirve esta plantilla en tu colegio…"
                    maxlength="500"
                  ></textarea>
                </label>
              </section>

              <section class="space-y-3">
                <div class="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Momentos de la clase
                    </h3>
                    <p class="mt-0.5 text-xs text-slate-500">
                      Cada fila es una fase. Puedes agregar o quitar según tu
                      metodología.
                    </p>
                  </div>
                  <p
                    class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    Total {{ totalMinutes() }} min · {{ draftPhases().length }}
                    {{ draftPhases().length === 1 ? 'fase' : 'fases' }}
                  </p>
                </div>

                <div class="space-y-2">
                  @for (phase of draftPhases(); track phase.id; let i = $index) {
                    <div class="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                      <div class="mb-2 flex items-center justify-between gap-2">
                        <span class="text-xs font-semibold text-slate-500"
                          >Fase {{ i + 1 }}</span
                        >
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm text-red-600"
                          [disabled]="draftPhases().length <= 1"
                          [attr.aria-label]="'Quitar fase ' + (i + 1)"
                          (click)="removePhase(phase.id)"
                        >
                          Quitar
                        </button>
                      </div>
                      <div class="grid gap-2 sm:grid-cols-[1fr_5.5rem]">
                        <label class="field">
                          <span class="label">Nombre</span>
                          <input
                            class="input"
                            [ngModel]="phase.name"
                            (ngModelChange)="patchPhase(phase.id, { name: $event })"
                            placeholder="Ej. Inicio"
                            maxlength="80"
                          />
                        </label>
                        <label class="field">
                          <span class="label">Minutos</span>
                          <input
                            class="input"
                            type="number"
                            min="1"
                            max="240"
                            [ngModel]="phase.durationMin"
                            (ngModelChange)="
                              patchPhase(phase.id, {
                                durationMin:
                                  $event === '' || $event == null ? null : +$event
                              })
                            "
                            placeholder="15"
                          />
                        </label>
                      </div>
                      <label class="field mt-2">
                        <span class="label"
                          >Qué se hace en esta fase
                          <span class="font-normal text-slate-400">(opcional)</span></span
                        >
                        <input
                          class="input"
                          [ngModel]="phase.description"
                          (ngModelChange)="
                            patchPhase(phase.id, { description: $event })
                          "
                          placeholder="Ej. Motivación y saberes previos"
                          maxlength="200"
                        />
                      </label>
                    </div>
                  }
                </div>

                <button
                  type="button"
                  class="btn btn-ghost btn-sm w-full border border-dashed border-slate-300"
                  (click)="addPhase()"
                >
                  <app-icon name="plus" [size]="14" />
                  Agregar otra fase
                </button>

                <button
                  type="button"
                  class="btn btn-ghost btn-sm text-slate-600"
                  (click)="applyStandardPhases()"
                >
                  Restaurar Inicio · Desarrollo · Cierre
                </button>
              </section>

              @if (editorError()) {
                <p
                  class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {{ editorError() }}
                </p>
              }
            </div>

            <footer
              class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3"
            >
              <p class="max-w-[14rem] text-xs text-slate-500 sm:max-w-none">
                Los docentes podrán elegir esta plantilla al planificar la clase.
              </p>
              <div class="flex gap-2">
                <button type="button" class="btn btn-ghost btn-sm" (click)="closeEditor()">
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="saving()"
                  (click)="saveEditor()"
                >
                  {{
                    saving()
                      ? 'Guardando…'
                      : editingUuid()
                        ? 'Guardar cambios'
                        : 'Crear plantilla'
                  }}
                </button>
              </div>
            </footer>
          </div>
        </div>
      }
    </div>
  `,
})
export class SessionTemplatesPageComponent implements OnInit {
  private readonly api = inject(SessionTemplatesApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private phaseSeq = 0;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly groups = signal<SessionTemplateGroup[]>([]);
  readonly query = signal('');
  readonly familyFilter = signal<FamilyFilter>('ALL');
  readonly busyUuid = signal<string | null>(null);

  readonly editorOpen = signal(false);
  readonly editingUuid = signal<string | null>(null);
  readonly saving = signal(false);
  readonly editorError = signal<string | null>(null);
  readonly draftPhases = signal<PhaseDraft[]>([]);
  readonly previewLoading = signal<string | null>(null);
  readonly preview = signal<CatalogPreviewState | null>(null);
  readonly mockSessionTitle = MOCK_SESSION_TITLE;
  draftKey = '';
  draftName = '';
  draftDescription = '';
  private keyTouched = false;

  readonly familyFilters = computed<FamilyFilter[]>(() => {
    const present = new Set(this.groups().map((g) => g.family));
    const order: FamilyFilter[] = ['ALL', 'STANDARD', 'COMMUNICATION', 'MATH', 'CUSTOM'];
    return order.filter((f) => f === 'ALL' || present.has(f as SessionTemplateFamily));
  });

  readonly filteredGroups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const ff = this.familyFilter();
    return this.groups()
      .filter((g) => ff === 'ALL' || g.family === ff)
      .map((g) => ({
        ...g,
        templates: g.templates.filter((t) => {
          if (!q) return true;
          return (
            t.name.toLowerCase().includes(q) ||
            t.templateKey.toLowerCase().includes(q) ||
            (t.description ?? '').toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.templates.length > 0);
  });

  readonly totalMinutes = computed(() =>
    this.draftPhases().reduce((sum, p) => sum + (p.durationMin ?? 0), 0),
  );

  ngOnInit(): void {
    void this.reload();
  }

  familyFilterLabel(f: FamilyFilter): string {
    return f === 'ALL' ? 'Todas' : SESSION_TEMPLATE_FAMILY_LABELS[f];
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.organized());
      this.groups.set(data.groups ?? []);
      const selected = this.familyFilter();
      if (selected !== 'ALL' && !this.groups().some((g) => g.family === selected)) {
        this.familyFilter.set('ALL');
      }
    } catch {
      this.error.set('No se pudieron cargar las plantillas de sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  async adopt(t: SessionTemplateListItem, setAsDefault: boolean): Promise<void> {
    this.busyUuid.set(t.publicUuid);
    try {
      await firstValueFrom(this.api.adopt(t.publicUuid, { setAsDefault }));
      this.closePreview();
      await this.reload();
    } catch {
      this.error.set('No se pudo adoptar la plantilla.');
    } finally {
      this.busyUuid.set(null);
    }
  }

  async adoptFromPreview(setAsDefault: boolean): Promise<void> {
    const p = this.preview();
    if (!p) return;
    await this.adopt(p.listItem, setAsDefault);
  }

  async openPreview(t: SessionTemplateListItem): Promise<void> {
    this.previewLoading.set(t.publicUuid);
    this.error.set(null);
    try {
      let detail: SessionTemplateDetail | null = null;
      try {
        detail = await firstValueFrom(this.api.get(t.publicUuid));
      } catch {
        detail = null;
      }
      const fromSchema = detail ? this.extractPreviewFromSchema(detail.schema) : null;
      const phases =
        fromSchema?.phases?.length
          ? fromSchema.phases
          : (t.phasesPreview ?? []).map((p) => ({
              name: p.name,
              durationMin: p.durationMin,
              description: p.description ?? '',
            }));
      const totalMinutes = phases.reduce((sum, p) => sum + (p.durationMin ?? 0), 0);
      this.preview.set({
        listItem: t,
        phases,
        activityTypes: fromSchema?.activityTypes ?? [],
        evaluationMethods: fromSchema?.evaluationMethods ?? [],
        materials: fromSchema?.materials ?? [],
        totalMinutes,
      });
    } catch {
      this.error.set('No se pudo cargar el ejemplo de la plantilla.');
      this.preview.set(null);
    } finally {
      this.previewLoading.set(null);
    }
  }

  closePreview(): void {
    this.preview.set(null);
  }

  humanizeToken(token: string): string {
    return token
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  exampleActivityLabel(phaseName: string): string {
    const n = phaseName.toLowerCase();
    if (n.includes('antes') || n.includes('inicio') || n.includes('vivencial')) {
      return 'Activación de saberes y motivación';
    }
    if (n.includes('durante') || n.includes('desarrollo') || n.includes('concreto') || n.includes('gráfico') || n.includes('simbólico')) {
      return 'Actividad principal de aprendizaje';
    }
    if (n.includes('después') || n.includes('cierre') || n.includes('aplicación')) {
      return 'Síntesis y metacognición';
    }
    return 'Actividad de la fase';
  }

  async setDefault(t: SessionTemplateListItem): Promise<void> {
    this.busyUuid.set(t.publicUuid);
    try {
      await firstValueFrom(this.api.setDefault(t.publicUuid));
      await this.reload();
    } catch {
      this.error.set('No se pudo marcar como predeterminada.');
    } finally {
      this.busyUuid.set(null);
    }
  }

  async remove(t: SessionTemplateListItem): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar plantilla',
      message: `¿Eliminar la plantilla «${t.name}»?`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    this.busyUuid.set(t.publicUuid);
    try {
      await firstValueFrom(this.api.delete(t.publicUuid));
      await this.reload();
    } catch {
      this.error.set('No se pudo eliminar la plantilla.');
    } finally {
      this.busyUuid.set(null);
    }
  }

  openCreate(): void {
    this.editingUuid.set(null);
    this.draftKey = '';
    this.draftName = '';
    this.draftDescription = '';
    this.keyTouched = false;
    this.draftPhases.set(DEFAULT_PHASES.map((p) => this.newPhase(p)));
    this.editorError.set(null);
    this.editorOpen.set(true);
  }

  async openEdit(t: SessionTemplateListItem): Promise<void> {
    this.editorError.set(null);
    this.editingUuid.set(t.publicUuid);
    this.draftKey = t.templateKey;
    this.draftName = t.name;
    this.draftDescription = t.description ?? '';
    this.keyTouched = true;
    try {
      const detail = await firstValueFrom(this.api.get(t.publicUuid));
      this.draftPhases.set(this.schemaToPhases(detail));
    } catch {
      const fromPreview = (t.phasesPreview ?? []).map((p) =>
        this.newPhase({
          name: p.name,
          durationMin: p.durationMin ?? 15,
          description: p.description ?? '',
        }),
      );
      this.draftPhases.set(
        fromPreview.length > 0
          ? fromPreview
          : DEFAULT_PHASES.map((p) => this.newPhase(p)),
      );
    }
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
  }

  onNameChange(name: string): void {
    this.draftName = name;
    if (!this.editingUuid() && !this.keyTouched) {
      this.draftKey = this.slugifyKey(name);
    }
  }

  addPhase(): void {
    this.draftPhases.update((list) => [
      ...list,
      this.newPhase({ name: '', durationMin: 15, description: '' }),
    ]);
  }

  removePhase(id: string): void {
    this.draftPhases.update((list) =>
      list.length <= 1 ? list : list.filter((p) => p.id !== id),
    );
  }

  patchPhase(id: string, patch: Partial<Omit<PhaseDraft, 'id'>>): void {
    this.draftPhases.update((list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  applyStandardPhases(): void {
    this.draftPhases.set(DEFAULT_PHASES.map((p) => this.newPhase(p)));
  }

  async saveEditor(): Promise<void> {
    const name = this.draftName.trim();
    if (!name) {
      this.editorError.set('Escribe un nombre para la plantilla.');
      return;
    }
    const phases = this.draftPhases();
    if (phases.length === 0) {
      this.editorError.set('Agrega al menos una fase.');
      return;
    }
    if (phases.some((p) => !p.name.trim())) {
      this.editorError.set('Cada fase necesita un nombre (ej. Inicio, Desarrollo).');
      return;
    }
    const badDuration = phases.find(
      (p) =>
        p.durationMin == null ||
        !Number.isFinite(p.durationMin) ||
        p.durationMin < 1 ||
        p.durationMin > 240,
    );
    if (badDuration) {
      this.editorError.set('Los minutos de cada fase deben estar entre 1 y 240.');
      return;
    }

    const schema = this.phasesToSchema(phases);
    this.saving.set(true);
    this.editorError.set(null);
    try {
      const uuid = this.editingUuid();
      if (uuid) {
        await firstValueFrom(
          this.api.update(uuid, {
            name,
            description: this.draftDescription.trim() || null,
            schema,
          }),
        );
      } else {
        const key =
          this.draftKey.trim() || this.slugifyKey(name) || `custom-${Date.now()}`;
        await firstValueFrom(
          this.api.create({
            templateKey: key,
            name,
            description: this.draftDescription.trim() || null,
            schema,
          }),
        );
      }
      this.editorOpen.set(false);
      await this.reload();
    } catch {
      this.editorError.set(
        'No se pudo guardar la plantilla. Revisa los datos e inténtalo de nuevo.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private newPhase(seed: Omit<PhaseDraft, 'id'>): PhaseDraft {
    this.phaseSeq += 1;
    return {
      id: `phase-${this.phaseSeq}`,
      name: seed.name,
      durationMin: seed.durationMin,
      description: seed.description,
    };
  }

  private schemaToPhases(detail: SessionTemplateDetail): PhaseDraft[] {
    const schema = detail.schema ?? {};
    const raw = Array.isArray(schema['phases']) ? (schema['phases'] as unknown[]) : [];
    const mapped = raw
      .map((p) => {
        if (!p || typeof p !== 'object') return null;
        const m = p as Record<string, unknown>;
        const dur = Number(m['duration_min'] ?? m['durationMin'] ?? 15);
        return this.newPhase({
          name: String(m['name'] ?? ''),
          durationMin: Number.isFinite(dur) ? dur : 15,
          description: String(m['description'] ?? ''),
        });
      })
      .filter((p): p is PhaseDraft => p != null);
    return mapped.length > 0
      ? mapped
      : DEFAULT_PHASES.map((p) => this.newPhase(p));
  }

  private phasesToSchema(phases: PhaseDraft[]): Record<string, unknown> {
    return {
      phases: phases.map((p) => ({
        name: p.name.trim(),
        duration_min: p.durationMin ?? 15,
        description: (p.description ?? '').trim(),
      })),
      activity_types: [],
      evaluation_methods: [],
      materials_suggested: [],
    };
  }

  private extractPreviewFromSchema(schema: Record<string, unknown> | null): {
    phases: PreviewPhase[];
    activityTypes: string[];
    evaluationMethods: string[];
    materials: string[];
  } | null {
    if (!schema) return null;
    const rawPhases = Array.isArray(schema['phases']) ? (schema['phases'] as unknown[]) : [];
    const phases = rawPhases
      .map((p) => {
        if (!p || typeof p !== 'object') return null;
        const m = p as Record<string, unknown>;
        const dur = Number(m['duration_min'] ?? m['durationMin'] ?? 0);
        return {
          name: String(m['name'] ?? ''),
          durationMin: Number.isFinite(dur) && dur > 0 ? dur : null,
          description: String(m['description'] ?? ''),
        } satisfies PreviewPhase;
      })
      .filter((p): p is PreviewPhase => p != null && !!p.name);

    const asStrings = (key: string): string[] => {
      const v = schema[key];
      if (!Array.isArray(v)) return [];
      return v.map((x) => String(x)).filter(Boolean);
    };

    return {
      phases,
      activityTypes: asStrings('activity_types'),
      evaluationMethods: asStrings('evaluation_methods'),
      materials: asStrings('materials_suggested'),
    };
  }

  private slugifyKey(name: string): string {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return base ? `custom-${base}` : '';
  }
}

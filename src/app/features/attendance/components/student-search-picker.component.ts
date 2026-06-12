import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { AcademicLevel, Grade, SectionRow } from '@features/academic/models';
import { AttendanceApiService } from '../services';
import {
  AttendanceListResult,
  AttendanceListPage
} from '../services/attendance-api.service';
import { AttendanceStudentLookupItem } from '../models';

/**
 * Standalone picker used by the attendance scanner page when the
 * student has no QR card on hand (Sprint 6 / FE-6.8 — manual
 * fallback). Lets the auxiliary search globally by name and narrow
 * the result down via cascading Nivel → Grado → Sección selects.
 *
 * <h3>Behaviour</h3>
 * <ul>
 *   <li>Loads the academic catalog ({@code AcademicApiService.listLevels})
 *       on init; the GET endpoints are reachable by {@code TEACHER}
 *       since BE-6.8 (see {@code AcademicLevelController}).</li>
 *   <li>The search box debounces at 300ms; an empty query with no
 *       filter active shows a hint instead of firing a global
 *       fetch.</li>
 *   <li>Results page size is 20 (server clamps anything larger to
 *       50).</li>
 *   <li>Selecting a row emits the {@code selected} event; the parent
 *       page is responsible for invoking {@code store.manualCheckIn}
 *       and rendering the feedback chip.</li>
 * </ul>
 *
 * <h3>Why standalone</h3>
 * Mirrors the existing modals ({@code open-session-modal},
 * {@code edit-record-modal}) and keeps the scanner page from growing
 * a 700-line template. Also lets future surfaces (admin tools, the
 * dashboard) embed the picker without re-importing the attendance
 * page module graph.
 */
@Component({
  selector: 'app-student-search-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-3" data-testid="student-search-picker">
      <!-- Cascading selects -->
      <div class="grid gap-2 sm:grid-cols-3">
        <div>
          <label class="label text-xs" for="picker-level">Nivel</label>
          <select
            id="picker-level"
            class="select select-sm w-full"
            [ngModel]="levelUuid()"
            (ngModelChange)="onLevelChange($event)"
            name="picker-level"
            [disabled]="loadingCatalog()"
          >
            <option [ngValue]="null">— Todos —</option>
            @for (lv of levels(); track lv.publicUuid) {
              <option [ngValue]="lv.publicUuid">{{ lv.name }}</option>
            }
          </select>
        </div>

        <div>
          <label class="label text-xs" for="picker-grade">Grado</label>
          <select
            id="picker-grade"
            class="select select-sm w-full"
            [ngModel]="gradeUuid()"
            (ngModelChange)="onGradeChange($event)"
            name="picker-grade"
            [disabled]="!levelUuid() || availableGrades().length === 0"
          >
            <option [ngValue]="null">— Todos —</option>
            @for (g of availableGrades(); track g.publicUuid) {
              <option [ngValue]="g.publicUuid">{{ g.name }}</option>
            }
          </select>
        </div>

        <div>
          <label class="label text-xs" for="picker-section">Sección</label>
          <select
            id="picker-section"
            class="select select-sm w-full"
            [ngModel]="sectionUuid()"
            (ngModelChange)="onSectionChange($event)"
            name="picker-section"
            [disabled]="!gradeUuid() || loadingSections() || sections().length === 0"
          >
            <option [ngValue]="null">— Todas —</option>
            @for (s of sections(); track s.publicUuid) {
              <option [ngValue]="s.publicUuid">{{ s.name }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Search input -->
      <div class="relative">
        <app-icon
          name="search"
          [size]="16"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="search"
          class="input input-bordered w-full pl-9 text-sm"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
          name="picker-query"
          placeholder="Buscar por nombre, apellido o documento…"
          autocomplete="off"
          data-testid="picker-search"
        />
      </div>

      <!-- Results -->
      <div
        class="rounded-md border bg-base-100 max-h-72 overflow-y-auto"
        data-testid="picker-results"
      >
        @if (loadingResults()) {
          <ul class="divide-y" aria-busy="true" aria-live="polite">
            @for (_ of [1, 2, 3]; track $index) {
              <li class="flex items-center gap-3 p-3 animate-pulse">
                <div class="h-9 w-9 rounded-full bg-slate-200"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-3 w-2/3 rounded bg-slate-200"></div>
                  <div class="h-2 w-1/3 rounded bg-slate-100"></div>
                </div>
              </li>
            }
          </ul>
        } @else if (error()) {
          <div
            class="flex items-center gap-2 p-4 text-sm text-error"
            role="alert"
          >
            <app-icon name="alert-circle" [size]="18" />
            <span>{{ error() }}</span>
          </div>
        } @else if (!hasQueryOrFilter()) {
          <div class="p-4 text-sm text-slate-500 text-center">
            Empieza a escribir o aplica filtros para buscar.
          </div>
        } @else if (results().length === 0) {
          <div class="p-4 text-sm text-slate-500 text-center">
            Sin resultados para los filtros aplicados.
          </div>
        } @else {
          <ul class="divide-y">
            @for (item of results(); track item.studentPublicUuid) {
              <li>
                <button
                  type="button"
                  class="w-full flex items-center gap-3 p-3 text-left hover:bg-base-200 focus:bg-base-200 focus:outline-none"
                  (click)="select(item)"
                  data-testid="picker-result"
                >
                  <span
                    class="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm"
                    aria-hidden="true"
                  >
                    {{ initials(item) }}
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="block font-medium truncate">
                      {{ item.fullName }}
                    </span>
                    <span class="block text-xs text-slate-500 truncate">
                      {{ item.gradeName }} · {{ item.sectionName }}
                      @if (item.documentNumber) {
                        · DNI {{ item.documentNumber }}
                      }
                    </span>
                  </span>
                  <app-icon
                    name="check"
                    [size]="16"
                    class="text-slate-400"
                  />
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `
})
export class StudentSearchPickerComponent implements OnInit {
  /** Fires when the auxiliary picks a student from the list. */
  readonly selected = output<AttendanceStudentLookupItem>();

  private readonly academicApi = inject(AcademicApiService);
  private readonly attendanceApi = inject(AttendanceApiService);

  // -------- catalog state --------
  protected readonly levels = signal<AcademicLevel[]>([]);
  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly loadingCatalog = signal(false);
  protected readonly loadingSections = signal(false);

  // -------- filter state --------
  protected readonly levelUuid = signal<string | null>(null);
  protected readonly gradeUuid = signal<string | null>(null);
  protected readonly sectionUuid = signal<string | null>(null);
  protected readonly query = signal('');

  // -------- result state --------
  protected readonly results = signal<AttendanceStudentLookupItem[]>([]);
  protected readonly loadingResults = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Grades for the currently selected level. */
  protected readonly availableGrades = computed<Grade[]>(() => {
    const uuid = this.levelUuid();
    if (!uuid) return [];
    const level = this.levels().find((lv) => lv.publicUuid === uuid);
    return level?.grades ?? [];
  });

  protected readonly hasQueryOrFilter = computed(
    () =>
      this.query().trim().length > 0 ||
      Boolean(this.levelUuid()) ||
      Boolean(this.gradeUuid()) ||
      Boolean(this.sectionUuid())
  );

  /** Token used to ignore stale fetches when filters change rapidly. */
  private fetchToken = 0;
  /** Debounce handle for the search input. */
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadLevels();
  }

  protected onLevelChange(value: string | null): void {
    this.levelUuid.set(value);
    this.gradeUuid.set(null);
    this.sectionUuid.set(null);
    this.sections.set([]);
    this.scheduleSearch(0);
  }

  protected onGradeChange(value: string | null): void {
    this.gradeUuid.set(value);
    this.sectionUuid.set(null);
    if (value) {
      void this.loadSections(value);
    } else {
      this.sections.set([]);
    }
    this.scheduleSearch(0);
  }

  protected onSectionChange(value: string | null): void {
    this.sectionUuid.set(value);
    this.scheduleSearch(0);
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.scheduleSearch(DEBOUNCE_MS);
  }

  protected select(item: AttendanceStudentLookupItem): void {
    this.selected.emit(item);
  }

  protected initials(item: AttendanceStudentLookupItem): string {
    const first = item.firstName?.[0] ?? '';
    const last = item.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }

  private async loadLevels(): Promise<void> {
    this.loadingCatalog.set(true);
    try {
      const levels = await firstValueFrom(this.academicApi.listLevels());
      this.levels.set(levels);
    } catch {
      // Soft-fail: levels endpoint failure should not block the
      // free-text search. The catalog selects just remain empty.
      this.levels.set([]);
    } finally {
      this.loadingCatalog.set(false);
    }
  }

  private async loadSections(gradeUuid: string): Promise<void> {
    this.loadingSections.set(true);
    try {
      const sections = await firstValueFrom(
        this.academicApi.listSections({ gradePublicUuid: gradeUuid })
      );
      this.sections.set(sections);
    } catch {
      this.sections.set([]);
    } finally {
      this.loadingSections.set(false);
    }
  }

  private scheduleSearch(delayMs: number): void {
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = null;
    }
    if (!this.hasQueryOrFilter()) {
      this.results.set([]);
      this.error.set(null);
      this.loadingResults.set(false);
      return;
    }
    const token = ++this.fetchToken;
    const run = (): void => {
      void this.fetchResults(token);
    };
    if (delayMs <= 0) {
      run();
    } else {
      this.debounceHandle = setTimeout(run, delayMs);
    }
  }

  private async fetchResults(token: number): Promise<void> {
    this.loadingResults.set(true);
    this.error.set(null);
    try {
      const page: AttendanceListPage = { page: 0, size: PAGE_SIZE };
      const result: AttendanceListResult<AttendanceStudentLookupItem> =
        await firstValueFrom(
          this.attendanceApi.lookupStudents(
            {
              q: this.query().trim() || undefined,
              levelPublicUuid: this.levelUuid() ?? undefined,
              gradePublicUuid: this.gradeUuid() ?? undefined,
              sectionPublicUuid: this.sectionUuid() ?? undefined
            },
            page
          )
        );
      if (token !== this.fetchToken) {
        // Stale response — a newer fetch has been kicked off; discard.
        return;
      }
      this.results.set(result.items);
    } catch (err) {
      if (token !== this.fetchToken) return;
      this.error.set(this.toErrorMessage(err));
      this.results.set([]);
    } finally {
      if (token === this.fetchToken) {
        this.loadingResults.set(false);
      }
    }
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    const message = (err as { message?: string })?.message;
    return message ?? 'No se pudo cargar la búsqueda. Reintenta en unos segundos.';
  }
}

/** Debounce window for the free-text search input. */
const DEBOUNCE_MS = 300;
/** Default page size for the lookup (server hard-caps at 50). */
const PAGE_SIZE = 20;

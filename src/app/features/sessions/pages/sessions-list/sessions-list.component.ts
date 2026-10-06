import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTES } from '@core/constants';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
  PageContainerComponent,
  PageHeaderComponent,
} from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { SessionsApiService } from '../../services';
import {
  LearningSessionRow,
  LearningSessionFilters,
  SharedLearningSession,
  SessionStatus,
  SESSION_STATUS_LABELS,
  SESSION_STATUS_BADGE_CLASS,
} from '../../models';

interface GradeAssignment {
  publicUuid: string;
  coursePublicUuid: string;
  academicPeriodPublicUuid: string;
  gradeName?: string | null;
  sectionName?: string;
  courseCode?: string;
  active?: boolean;
}

/**
 * `/learning-sessions` — Listado de sesiones de aprendizaje con filtros.
 *
 * <h3>Características</h3>
 * <ul>
 *   <li>Filtros URL-synced: teacher, section, unit, date range, status.</li>
 *   <li>Tabla con columnas: fecha, curso, sección, unidad, estado, acciones.</li>
 *   <li>Acciones de lifecycle: Iniciar, Completar, Cancelar.</li>
 *   <li>Selección múltiple para acción bulk "Completar seleccionadas".</li>
 * </ul>
 */
@Component({
  selector: 'app-sessions-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    PageContainerComponent,
    PageHeaderComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Sesiones de Aprendizaje"
        title="Listado de Sesiones"
        subtitle="Planifica, ejecuta y da seguimiento a las sesiones de clase."
      >
        <button type="button" class="btn btn-primary btn-sm" (click)="onCreate()">
          <app-icon name="plus" [size]="16" />
          <span>Nueva Sesión</span>
        </button>
      </app-page-header>

      @if (sharedSessions().length > 0) {
        <section class="card mb-4">
          <header class="card-header">
            <h3 class="card-title">Sesiones del grado</h3>
            <p class="card-description">
              Planes que otros docentes compartieron. Puedes copiarlos a tu sección.
            </p>
          </header>
          <div class="card-body grid gap-4">
            @for (shared of sharedSessions(); track shared.publicUuid) {
              <div class="rounded-md border border-border-subtle p-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="font-medium">{{ shared.title }}</p>
                    <p class="text-xs text-content-muted">
                      {{ shared.authorName }} · {{ shared.gradeName }} {{ shared.sectionName }} ·
                      {{ shared.courseCode }}
                    </p>
                    @if (shared.objective) {
                      <p class="mt-1 text-sm text-content">{{ shared.objective }}</p>
                    }
                  </div>
                  <button type="button" class="btn btn-outline btn-sm" (click)="startCopy(shared)">
                    Usar en mi sección
                  </button>
                </div>
                @if (copyTargetId() === shared.publicUuid) {
                  @if (matchingAssignments(shared).length === 0) {
                    <p class="mt-3 text-sm text-content-muted">
                      No tienes una asignación activa de ese curso y grado.
                    </p>
                  } @else {
                    <div class="mt-3 grid gap-3 sm:grid-cols-2">
                      <div class="field">
                        <label class="label">Mi sección</label>
                        <select
                          class="select"
                          [value]="copyAssignmentId()"
                          (change)="copyAssignmentId.set($any($event.target).value)"
                        >
                          @for (assignment of matchingAssignments(shared); track assignment.publicUuid) {
                            <option [value]="assignment.publicUuid">
                              {{ assignment.gradeName }} {{ assignment.sectionName }} ·
                              {{ assignment.courseCode }}
                            </option>
                          }
                        </select>
                      </div>
                      <div class="field">
                        <label class="label">Fecha</label>
                        <input
                          type="date"
                          class="input"
                          [value]="copyDate()"
                          (change)="copyDate.set($any($event.target).value)"
                        />
                      </div>
                      <button
                        type="button"
                        class="btn btn-primary btn-sm w-fit"
                        [disabled]="copying()"
                        (click)="confirmCopy(shared)"
                      >
                        Crear copia
                      </button>
                    </div>
                  }
                }
              </div>
            }
          </div>
        </section>
      }

      <!-- Filtros -->
      <section class="card mb-4">
        <div class="card-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="field">
            <label class="label">Estado</label>
            <select
              class="select"
              [value]="filters().status ?? ''"
              (change)="onFilterChange('status', $any($event.target).value || undefined)"
            >
              <option value="">Todos</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ getStatusLabel(s) }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="label">Desde</label>
            <input
              type="date"
              class="input"
              [value]="filters().dateFrom ?? ''"
              (change)="onFilterChange('dateFrom', $any($event.target).value || undefined)"
            />
          </div>

          <div class="field">
            <label class="label">Hasta</label>
            <input
              type="date"
              class="input"
              [value]="filters().dateTo ?? ''"
              (change)="onFilterChange('dateTo', $any($event.target).value || undefined)"
            />
          </div>

          <div class="flex items-end">
            <button type="button" class="btn btn-ghost btn-sm w-full" (click)="clearFilters()">
              <app-icon name="x" [size]="16" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Bulk Actions -->
      @if (selectedSessions().size > 0) {
        <div
          class="mb-4 flex items-center justify-between rounded-md border border-primary-200 bg-primary-50 p-3"
        >
          <span class="text-sm font-medium text-primary-700">
            {{ selectedSessions().size }} sesión(es) seleccionada(s)
          </span>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm text-primary-700"
              (click)="clearSelection()"
            >
              Deseleccionar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="bulkActionLoading()"
              (click)="bulkComplete()"
            >
              @if (bulkActionLoading()) {
                <app-spinner [size]="14" label="Procesando" />
                <span>Procesando...</span>
              } @else {
                <app-icon name="check" [size]="16" />
                <span>Completar seleccionadas</span>
              }
            </button>
          </div>
        </div>
      }

      <!-- Tabla -->
      <section class="card overflow-hidden">
        @if (loading()) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando sesiones…" />
          </div>
        } @else if (errorMessage()) {
          <div class="alert alert-danger m-5">
            <app-icon name="alert-circle" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">No pudimos cargar las sesiones.</p>
              <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" (click)="loadSessions()">
              Reintentar
            </button>
          </div>
        } @else if (sessions().length === 0) {
          <app-empty-state
            icon="calendar"
            title="No se encontraron sesiones"
            description="Prueba ajustando los filtros o crea una nueva sesión."
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th class="w-10">
                    <input
                      type="checkbox"
                      class="form-checkbox"
                      [checked]="isAllSelected()"
                      [indeterminate]="isIndeterminate()"
                      (change)="toggleSelectAll()"
                    />
                  </th>
                  <th>Fecha</th>
                  <th>Curso</th>
                  <th>Sección</th>
                  <th>Unidad</th>
                  <th>Estado</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (session of sessions(); track session.publicUuid) {
                  <tr class="hover:bg-surface-subtle">
                    <td>
                      <input
                        type="checkbox"
                        class="form-checkbox"
                        [checked]="selectedSessions().has(session.publicUuid)"
                        (change)="toggleSelection(session.publicUuid)"
                        [disabled]="
                          session.status !== 'PLANNED' && session.status !== 'IN_PROGRESS'
                        "
                      />
                    </td>
                    <td>
                      <p class="font-medium text-content">
                        {{ formatDate(session.scheduledDate) }}
                      </p>
                      <p class="text-xs text-content-muted">{{ session.durationMinutes }} min</p>
                    </td>
                    <td>
                      <p class="font-medium text-content">{{ session.courseCode }}</p>
                      <p class="text-xs text-content-muted">{{ session.teacherName }}</p>
                    </td>
                    <td class="text-content">{{ session.sectionName }}</td>
                    <td class="text-content">
                      <span class="text-xs text-content-muted"
                        >{{ session.unitDisplayOrder }}.</span
                      >
                      {{ session.unitName }}
                    </td>
                    <td>
                      <span class="badge" [ngClass]="getStatusBadgeClass(session.status)">
                        {{ getStatusLabel(session.status) }}
                      </span>
                    </td>
                    <td class="text-right">
                      <div class="flex justify-end gap-1">
                        @if (session.status === 'PLANNED') {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs text-primary-600"
                            title="Iniciar"
                            [disabled]="actionLoading().has(session.publicUuid)"
                            (click)="startSession(session)"
                          >
                            <app-icon name="chevron-right" [size]="14" />
                          </button>
                        }
                        @if (session.status === 'IN_PROGRESS') {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs text-success-600"
                            title="Completar"
                            [disabled]="actionLoading().has(session.publicUuid)"
                            (click)="completeSession(session)"
                          >
                            <app-icon name="check" [size]="14" />
                          </button>
                        }
                        @if (session.status === 'PLANNED' || session.status === 'IN_PROGRESS') {
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs text-danger-600"
                            title="Cancelar"
                            [disabled]="actionLoading().has(session.publicUuid)"
                            (click)="cancelSession(session)"
                          >
                            <app-icon name="x" [size]="14" />
                          </button>
                        }
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs"
                          title="Ver detalle"
                          (click)="viewDetail(session.publicUuid)"
                        >
                          <app-icon name="eye" [size]="14" />
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </app-page-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .table {
        @apply w-full text-left text-sm;
      }
      .table th {
        @apply border-b border-border-subtle bg-surface-subtle px-4 py-3 text-xs font-semibold uppercase tracking-wider text-content-muted;
      }
      .table td {
        @apply border-b border-border-subtle px-4 py-3;
      }
    `,
  ],
})
export class SessionsListComponent implements OnInit {
  private readonly api = inject(SessionsApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly sessions = signal<LearningSessionRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedSessions = signal<Set<string>>(new Set());
  protected readonly bulkActionLoading = signal(false);
  protected readonly actionLoading = signal<Set<string>>(new Set());
  protected readonly sharedSessions = signal<SharedLearningSession[]>([]);
  protected readonly myAssignments = signal<GradeAssignment[]>([]);
  protected readonly copyTargetId = signal<string | null>(null);
  protected readonly copyAssignmentId = signal('');
  protected readonly copyDate = signal('');
  protected readonly copying = signal(false);

  protected readonly filters = computed<LearningSessionFilters>(() => {
    const qp = this.route.snapshot.queryParamMap;
    return {
      status: (qp.get('status') as SessionStatus | null) || undefined,
      dateFrom: qp.get('dateFrom') || undefined,
      dateTo: qp.get('dateTo') || undefined,
    };
  });

  protected readonly statuses: SessionStatus[] = [
    SessionStatus.PLANNED,
    SessionStatus.IN_PROGRESS,
    SessionStatus.COMPLETED,
    SessionStatus.CANCELLED,
  ];

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadSessions(), this.loadShared()]);
  }

  private async loadShared(): Promise<void> {
    try {
      const [shared, assignments] = await Promise.all([
        firstValueFrom(this.api.listSharedSessions()),
        firstValueFrom(this.academicApi.listAssignments({ activeOnly: true })),
      ]);
      this.sharedSessions.set(shared);
      this.myAssignments.set(assignments as GradeAssignment[]);
    } catch {
      this.sharedSessions.set([]);
    }
  }

  protected matchingAssignments(shared: SharedLearningSession): GradeAssignment[] {
    return this.myAssignments().filter(
      (row) =>
        row.active !== false &&
        row.coursePublicUuid === shared.coursePublicUuid &&
        row.academicPeriodPublicUuid === shared.periodPublicUuid &&
        (row.gradeName ?? '') === shared.gradeName,
    );
  }

  protected startCopy(shared: SharedLearningSession): void {
    if (this.copyTargetId() === shared.publicUuid) {
      this.copyTargetId.set(null);
      return;
    }
    const matches = this.matchingAssignments(shared);
    this.copyTargetId.set(shared.publicUuid);
    this.copyAssignmentId.set(matches[0]?.publicUuid ?? '');
    this.copyDate.set(shared.scheduledDate);
  }

  protected async confirmCopy(shared: SharedLearningSession): Promise<void> {
    if (!this.copyAssignmentId() || !this.copyDate()) return;
    this.copying.set(true);
    this.errorMessage.set(null);
    try {
      const created = await firstValueFrom(
        this.api.copySession(shared.publicUuid, {
          assignmentUuid: this.copyAssignmentId(),
          scheduledDate: this.copyDate(),
        }),
      );
      await this.router.navigate([ROUTES.SESSIONS.detail(created.publicUuid)]);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo copiar la sesión');
    } finally {
      this.copying.set(false);
    }
  }

  protected async loadSessions(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const data = await firstValueFrom(this.api.listSessions(this.filters()));
      this.sessions.set(data);
      this.clearSelection();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error de red');
    } finally {
      this.loading.set(false);
    }
  }

  protected onFilterChange(key: keyof LearningSessionFilters, value: string | undefined): void {
    const current = this.filters();
    const next: LearningSessionFilters = { ...current, [key]: value };

    // Limpiar valores undefined para no ensuciar la URL
    const cleanParams: Record<string, string> = {};
    if (next['status']) cleanParams['status'] = next['status'];
    if (next['dateFrom']) cleanParams['dateFrom'] = next['dateFrom'];
    if (next['dateTo']) cleanParams['dateTo'] = next['dateTo'];

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleanParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });

    // Recargar datos
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.listSessions(next).subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.clearSelection();
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err instanceof Error ? err.message : 'Error de red');
        this.loading.set(false);
      },
    });
  }

  protected clearFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
    void this.loadSessions();
  }

  protected getStatusLabel(status: SessionStatus): string {
    return SESSION_STATUS_LABELS[status];
  }

  protected getStatusBadgeClass(status: SessionStatus): string {
    return SESSION_STATUS_BADGE_CLASS[status];
  }

  protected formatDate(date: Date): string {
    return date.toLocaleDateString('es', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ===========================================================================
  // Selection & Bulk Actions
  // ===========================================================================

  protected toggleSelection(publicUuid: string): void {
    const set = new Set(this.selectedSessions());
    if (set.has(publicUuid)) {
      set.delete(publicUuid);
    } else {
      set.add(publicUuid);
    }
    this.selectedSessions.set(set);
  }

  protected clearSelection(): void {
    this.selectedSessions.set(new Set());
  }

  protected isAllSelected(): boolean {
    if (this.sessions().length === 0) return false;
    const selectable = this.sessions().filter(
      (s) => s.status === SessionStatus.PLANNED || s.status === SessionStatus.IN_PROGRESS,
    );
    return (
      selectable.length > 0 && selectable.every((s) => this.selectedSessions().has(s.publicUuid))
    );
  }

  protected isIndeterminate(): boolean {
    const selectable = this.sessions().filter(
      (s) => s.status === SessionStatus.PLANNED || s.status === SessionStatus.IN_PROGRESS,
    );
    const selectedCount = Array.from(this.selectedSessions()).filter((uuid) =>
      selectable.some((s) => s.publicUuid === uuid),
    ).length;
    return selectedCount > 0 && selectedCount < selectable.length;
  }

  protected toggleSelectAll(): void {
    const selectable = this.sessions().filter(
      (s) => s.status === SessionStatus.PLANNED || s.status === SessionStatus.IN_PROGRESS,
    );
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedSessions.set(new Set(selectable.map((s) => s.publicUuid)));
    }
  }

  protected async bulkComplete(): Promise<void> {
    const toComplete = Array.from(this.selectedSessions());
    if (toComplete.length === 0) return;

    this.bulkActionLoading.set(true);
    try {
      // Ejecutar en paralelo, pero capturando errores individualmente
      const results = await Promise.allSettled(
        toComplete.map((uuid) => {
          const session = this.sessions().find((s) => s.publicUuid === uuid);
          if (!session) return Promise.reject(new Error('Sesión no encontrada'));
          return firstValueFrom(this.api.completeSession(uuid, { version: session.version }));
        }),
      );

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        this.errorMessage.set(`${failures.length} sesión(es) no pudieron completarse.`);
      }

      await this.loadSessions();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al procesar en lote');
    } finally {
      this.bulkActionLoading.set(false);
    }
  }

  // ===========================================================================
  // Lifecycle Actions
  // ===========================================================================

  protected async startSession(session: LearningSessionRow): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Iniciar sesión',
      message: `¿Iniciar la sesión "${session.title}"?`,
      confirmLabel: 'Iniciar',
      variant: 'default',
    });
    if (!ok) return;
    this.setActionLoading(session.publicUuid, true);
    try {
      await firstValueFrom(this.api.startSession(session.publicUuid, { version: session.version }));
      await this.loadSessions();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al iniciar');
    } finally {
      this.setActionLoading(session.publicUuid, false);
    }
  }

  protected async completeSession(session: LearningSessionRow): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Completar sesión',
      message: `¿Marcar como completada la sesión "${session.title}"?`,
      confirmLabel: 'Completar',
      variant: 'warning',
    });
    if (!ok) return;
    this.setActionLoading(session.publicUuid, true);
    try {
      await firstValueFrom(
        this.api.completeSession(session.publicUuid, { version: session.version }),
      );
      await this.loadSessions();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al completar');
    } finally {
      this.setActionLoading(session.publicUuid, false);
    }
  }

  protected async cancelSession(session: LearningSessionRow): Promise<void> {
    const reason = prompt('Motivo de cancelación (opcional):');
    if (reason === null) return; // Usuario canceló el prompt

    this.setActionLoading(session.publicUuid, true);
    try {
      await firstValueFrom(
        this.api.cancelSession(session.publicUuid, {
          version: session.version,
          reason: reason || undefined,
        }),
      );
      await this.loadSessions();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      this.setActionLoading(session.publicUuid, false);
    }
  }

  private setActionLoading(publicUuid: string, loading: boolean): void {
    const set = new Set(this.actionLoading());
    if (loading) {
      set.add(publicUuid);
    } else {
      set.delete(publicUuid);
    }
    this.actionLoading.set(set);
  }

  protected onCreate(): void {
    void this.router.navigate([ROUTES.SESSIONS.NEW]);
  }

  protected viewDetail(publicUuid: string): void {
    void this.router.navigate([ROUTES.SESSIONS.detail(publicUuid)]);
  }
}

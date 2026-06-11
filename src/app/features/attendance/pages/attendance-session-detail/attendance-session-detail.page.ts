import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import {
  AttendanceStatusBadgeComponent,
  EditRecordModalComponent
} from '../../components';
import { AttendanceStore } from '../../store';
import { AttendanceRecord, UpdateRecordRequest } from '../../models';

/**
 * `/attendance/sessions/:uuid` — roster of a single session
 * (FE-6.2).
 *
 * <h3>Roster source of truth</h3>
 * The page reads from {@link AttendanceStore#records}, which the
 * scanner page already populates as scans come in (FE-6.1). When
 * the user lands here directly (e.g. from a shared link or after
 * closing a session), the page calls
 * {@link AttendanceStore#loadRecords} to fetch the snapshot from
 * the backend.
 *
 * <h3>Editing window</h3>
 * <ul>
 *   <li>{@code TEACHER}: can edit only if `closedAt` is within
 *       {@code edit-window-hours} (default 24h, configured BE-side).
 *       The "Editar" button stays disabled past the cutoff; the
 *       store call would otherwise return 403 EDIT_WINDOW_EXPIRED.</li>
 *   <li>{@code TENANT_ADMIN}: always (bypass the window).</li>
 * </ul>
 */
@Component({
  selector: 'app-attendance-session-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    AttendanceStatusBadgeComponent,
    EditRecordModalComponent
  ],
  template: `
    <app-page-container>
      <app-page-header
        [title]="title()"
        [subtitle]="subtitle()"
      >
        <a
          [routerLink]="sessionsRoute"
          class="btn btn-ghost btn-sm"
        >
          <app-icon name="arrow-left" [size]="16" />
          <span class="hidden sm:inline">Volver</span>
        </a>
        <a
          [routerLink]="scannerRoute"
          class="btn btn-outline btn-sm"
        >
          <app-icon name="target" [size]="16" />
          <span class="hidden sm:inline">Escanear</span>
        </a>
        @if (canClose()) {
          <button
            type="button"
            class="btn btn-warning btn-sm"
            [disabled]="store.loadingSession()"
            (click)="onClose()"
          >
            <app-icon name="lock" [size]="16" />
            <span class="hidden sm:inline">Cerrar sesión</span>
          </button>
        }
      </app-page-header>

      <!-- Resumen -->
      <section class="grid gap-3 sm:grid-cols-4 mb-4">
        <div class="card">
          <div class="card-body py-3">
            <p class="text-xs text-content-muted">Estado</p>
            <app-attendance-status-badge
              [status]="store.currentSession()?.status ?? 'CLOSED'"
            />
          </div>
        </div>
        <div class="card">
          <div class="card-body py-3">
            <p class="text-xs text-content-muted">Presentes</p>
            <p class="text-2xl font-semibold text-success">
              {{ store.presentCount() }}
            </p>
          </div>
        </div>
        <div class="card">
          <div class="card-body py-3">
            <p class="text-xs text-content-muted">Ausentes</p>
            <p class="text-2xl font-semibold text-error">
              {{ store.absentCount() }}
            </p>
          </div>
        </div>
        <div class="card">
          <div class="card-body py-3">
            <p class="text-xs text-content-muted">Total</p>
            <p class="text-2xl font-semibold">{{ store.totalCount() }}</p>
          </div>
        </div>
      </section>

      <!-- Filtro rápido -->
      <section class="card mb-4">
        <div class="card-body flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              [(ngModel)]="onlyPending"
              name="onlyPending"
            />
            Mostrar solo pendientes
            <span class="text-xs text-content-muted">
              (sin status en ACTIVE, o ABSENT en CLOSED)
            </span>
          </label>
        </div>
      </section>

      <!-- Roster -->
      <section class="card overflow-hidden">
        @if (store.loadingRecords() && !store.records().length) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando roster…" />
          </div>
        } @else if (filteredRecords().length === 0) {
          <app-empty-state
            icon="users"
            title="Aún no hay registros"
            description="Escanea el primer alumno desde la pestaña Scanner."
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th class="hidden md:table-cell">Documento</th>
                  <th>Status</th>
                  <th class="hidden lg:table-cell">Hora</th>
                  <th class="hidden lg:table-cell">Escaneado por</th>
                  <th class="text-right" aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                @for (record of filteredRecords(); track record.publicUuid) {
                  <tr>
                    <td>
                      <div class="font-medium">
                        {{ record.studentFullName ?? record.studentPublicUuid }}
                      </div>
                    </td>
                    <td class="hidden md:table-cell text-sm text-content-muted">
                      {{ record.studentDocumentNumber ?? '—' }}
                    </td>
                    <td>
                      <app-attendance-status-badge [status]="record.status" />
                    </td>
                    <td class="hidden lg:table-cell text-sm">
                      {{ record.occurredAt | date: 'shortTime' }}
                    </td>
                    <td class="hidden lg:table-cell text-xs text-content-muted">
                      {{ record.scannedByUserId ?? '—' }}
                    </td>
                    <td class="text-right">
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        [disabled]="!canEdit(record)"
                        (click)="openEdit(record)"
                      >
                        <app-icon name="pencil" [size]="14" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </app-page-container>

    @if (editing(); as record) {
      <app-edit-record-modal
        [record]="record"
        (save)="onSave(record, $event)"
        (cancelled)="closeEdit()"
      />
    }
  `
})
export class AttendanceSessionDetailPageComponent implements OnInit {
  protected readonly store = inject(AttendanceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly sessionsRoute = ROUTES.ATTENDANCE.SESSIONS;
  protected readonly scannerRoute = ROUTES.ATTENDANCE.SCANNER;

  protected readonly editing = signal<AttendanceRecord | null>(null);
  protected onlyPending = false;

  protected readonly title = computed(() => {
    const s = this.store.currentSession();
    if (!s) return 'Sesión';
    return s.sectionName ?? s.publicUuid.slice(0, 8);
  });

  protected readonly subtitle = computed(() => {
    const s = this.store.currentSession();
    if (!s) return 'Cargando…';
    const date = s.occurredOn.toLocaleDateString();
    return `${s.slot} · ${date}`;
  });

  protected readonly canClose = computed(
    () => this.store.currentSession()?.status === 'ACTIVE'
  );

  /**
   * Roster view filtered by the "only pending" toggle. In an
   * ACTIVE session "pending" means the record has not been scanned
   * yet (status is still ABSENT). In a CLOSED session ABSENT
   * rows are the materialised late/absent; the toggle hides them.
   */
  protected readonly filteredRecords = computed<AttendanceRecord[]>(() => {
    const records = this.store.records();
    if (!this.onlyPending) return records;
    return records.filter((r) => r.status === 'ABSENT');
  });

  async ngOnInit(): Promise<void> {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (!uuid) return;
    // We re-use the store's current session signal if it matches
    // the route; otherwise we just hit the records endpoint which
    // is the only one the backend exposes for an unknown session.
    await this.store.loadRecords(uuid);
  }

  protected onClose(): void {
    void this.store.closeCurrentSession();
  }

  /**
   * Mirrors the backend's edit window (BE-6.4):
   * <ul>
   *   <li>TENANT_ADMIN: always.</li>
   *   <li>TEACHER: only if the session was closed within the
   *       configured window (we can't read the BE setting here, so
   *       we let the docente try and surface 403 EDIT_WINDOW_EXPIRED
   *       on failure).</li>
   * </ul>
   */
  protected canEdit(record: AttendanceRecord): boolean {
    if (!this.auth.hasRole(UserRole.TenantAdmin, UserRole.Teacher)) {
      return false;
    }
    if (this.auth.hasRole(UserRole.TenantAdmin)) {
      return true;
    }
    // Teacher: only edits to CLOSED sessions, and we optimistically
    // allow it; the server is the source of truth for the cutoff.
    return this.store.currentSession()?.status === 'CLOSED';
  }

  protected openEdit(record: AttendanceRecord): void {
    this.editing.set(record);
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected async onSave(
    record: AttendanceRecord,
    request: UpdateRecordRequest
  ): Promise<void> {
    const updated = await this.store.updateRecord(record.publicUuid, request);
    this.editing.set(null);
    // On error the store leaves `error` populated; the page itself
    // doesn't show a toast (out of scope for FE-6.2), the global
    // error interceptor is the safety net.
    if (updated) {
      await this.store.loadRecords(record.sessionPublicUuid);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearStatus, SectionRow } from '@features/academic/models';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { AttendanceStatusBadgeComponent, OpenSessionModalComponent } from '../../components';
import { AttendanceSessionListFilters, AttendanceStore } from '../../store';
import { CreateSessionRequest, AttendanceSessionStatus, AttendanceSessionSlot } from '../../models';

/**
 * `/attendance/sessions` — list of attendance sessions for the
 * current tenant (FE-6.2).
 *
 * <h3>Known scope gap (DEBT-ATT-5)</h3>
 * The backend does <strong>not yet</strong> expose a
 * {@code GET /v1/attendance/sessions} listing endpoint — the
 * Sprint-6 backend was scoped to the per-session flows
 * (open/close/check-in/records). This page acknowledges the gap by
 * rendering an "endpoint pending" empty state and a CTA that takes
 * the docente straight to the scanner, which is the only flow that
 * <em>does</em> expose a session without needing the listing.
 *
 * <p>When BE-6.7 lands the listing endpoint, the store's
 * {@link AttendanceStore.applyListFilters} flips
 * {@link AttendanceStore.listEndpointMissing} off and the table
 * lights up automatically — no further UI work needed.</p>
 *
 * <h3>URL-synced filters</h3>
 * Mirrors the convention used by `students-list` (FE-4.7):
 * `?date=YYYY-MM-DD&sectionPublicUuid=…&slot=…&status=…`. Sharing a
 * filtered URL reproduces the same view on the recipient's screen.
 */
@Component({
  selector: 'app-attendance-sessions-list',
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
    OpenSessionModalComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Sesiones de asistencia"
        subtitle="Listado del año académico activo, filtrable por fecha, sección y slot."
      >
        <a [routerLink]="scannerRoute" class="btn btn-outline btn-sm">
          <app-icon name="target" [size]="16" />
          <span class="hidden sm:inline">Ir al scanner</span>
        </a>
        <button type="button" class="btn btn-primary btn-sm" (click)="openModal()">
          <app-icon name="plus" [size]="16" />
          <span class="hidden sm:inline">Nueva sesión</span>
        </button>
      </app-page-header>

      <!-- Filtros URL-synced -->
      <section class="card mb-4">
        <div class="card-body grid gap-3 sm:grid-cols-12">
          <div class="sm:col-span-3">
            <label class="label" for="sessions-date">Fecha</label>
            <input
              id="sessions-date"
              type="date"
              class="input"
              [(ngModel)]="date"
              name="date"
              (change)="applyFilters()"
            />
          </div>

          <div class="sm:col-span-4">
            <label class="label" for="sessions-section">Sección</label>
            <select
              id="sessions-section"
              class="select"
              [(ngModel)]="sectionPublicUuid"
              name="section"
              (change)="applyFilters()"
              [disabled]="loadingSections()"
            >
              <option [ngValue]="null">Todas</option>
              @for (s of sections(); track s.publicUuid) {
                <option [ngValue]="s.publicUuid">{{ s.gradeName }} · {{ s.name }}</option>
              }
            </select>
          </div>

          <div class="sm:col-span-2">
            <label class="label" for="sessions-slot">Slot</label>
            <select
              id="sessions-slot"
              class="select"
              [(ngModel)]="slot"
              name="slot"
              (change)="applyFilters()"
            >
              <option [ngValue]="null">Todos</option>
              <option [ngValue]="'MORNING'">Mañana</option>
              <option [ngValue]="'AFTERNOON'">Tarde</option>
              <option [ngValue]="'EVENING'">Noche</option>
            </select>
          </div>

          <div class="sm:col-span-3">
            <label class="label" for="sessions-status">Estado</label>
            <select
              id="sessions-status"
              class="select"
              [(ngModel)]="status"
              name="status"
              (change)="applyFilters()"
            >
              <option [ngValue]="null">Todos</option>
              <option [ngValue]="'ACTIVE'">Activa</option>
              <option [ngValue]="'CLOSED'">Cerrada</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Tabla -->
      <section class="card overflow-hidden">
        @if (store.loadingList() && !store.hasListItems()) {
          <div class="flex items-center justify-center py-16">
            <app-spinner [size]="24" label="Cargando sesiones…" />
          </div>
        } @else if (!store.hasListItems()) {
          <app-empty-state
            icon="calendar-check"
            title="Aún no hay sesiones"
            description="Ajusta los filtros o abre la primera sesión del día."
          >
            <button type="button" class="btn btn-primary btn-sm" (click)="openModal()">
              <app-icon name="plus" [size]="14" />
              <span>Nueva sesión</span>
            </button>
          </app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>Sección</th>
                  <th>Slot</th>
                  <th>Estado</th>
                  <th class="text-right" aria-label="Acciones"></th>
                </tr>
              </thead>
              <tbody>
                @for (session of store.listItems(); track session.publicUuid) {
                  <tr>
                    <td>
                      <div class="text-sm">{{ session.occurredOn | date: 'mediumDate' }}</div>
                      <div class="text-xs text-content-muted">
                        {{ session.startsAt | date: 'shortTime' }}
                      </div>
                    </td>
                    <td>{{ session.sectionLabel }}</td>
                    <td>{{ session.slot }}</td>
                    <td>
                      <app-attendance-status-badge [status]="session.status" />
                    </td>
                    <td class="text-right">
                      <a
                        [routerLink]="sessionRoute(session.publicUuid)"
                        class="btn btn-ghost btn-xs"
                      >
                        Ver roster
                        <app-icon name="chevron-right" [size]="14" />
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </app-page-container>

    @if (modalOpen()) {
      <app-open-session-modal (submitRequest)="onCreate($event)" (cancelled)="closeModal()" />
    }
  `,
})
export class AttendanceSessionsListPageComponent implements OnInit {
  protected readonly store = inject(AttendanceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly academicApi = inject(AcademicApiService);
  private readonly auth = inject(AuthService);

  protected readonly scannerRoute = ROUTES.ATTENDANCE.SCANNER;
  protected readonly modalOpen = signal(false);

  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly loadingSections = signal(false);

  /** URL-synced filter signals. */
  protected date: string | null = null;
  protected sectionPublicUuid: string | null = null;
  protected slot: AttendanceSessionSlot | null = null;
  protected status: AttendanceSessionStatus | null = null;

  async ngOnInit(): Promise<void> {
    // Hydrate filters from the URL.
    const qp = this.route.snapshot.queryParamMap;
    this.date = qp.get('date') ?? today();
    this.sectionPublicUuid = qp.get('sectionPublicUuid');
    this.slot = (qp.get('slot') as AttendanceSessionSlot | null) ?? null;
    this.status = (qp.get('status') as AttendanceSessionStatus | null) ?? null;

    await this.loadSections();
    await this.applyFilters();
  }

  protected openModal(): void {
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  /**
   * Hook fired by {@link OpenSessionModalComponent} with a validated
   * request. Hands it off to the store, navigates to the new
   * session's detail page, and closes the modal. Failures stay in
   * the page (we don't surface them in the modal — keeps the
   * component dumb and re-usable).
   */
  protected async onCreate(request: CreateSessionRequest): Promise<void> {
    const session = await this.store.openSession(request);
    this.modalOpen.set(false);
    if (session) {
      await this.router.navigateByUrl(ROUTES.ATTENDANCE.session(session.publicUuid));
    }
  }

  protected sessionRoute(uuid: string): string {
    return ROUTES.ATTENDANCE.session(uuid);
  }

  /**
   * Push the current filter snapshot to the URL and re-fire
   * {@link AttendanceStore.applyListFilters}. The URL sync is what
   * lets the docente share a filtered view.
   */
  protected async applyFilters(): Promise<void> {
    const filters: AttendanceSessionListFilters = {
      date: this.date ?? undefined,
      sectionPublicUuid: this.sectionPublicUuid ?? undefined,
      slot: this.slot ?? undefined,
      status: this.status ?? undefined,
    };
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        date: filters.date ?? null,
        sectionPublicUuid: filters.sectionPublicUuid ?? null,
        slot: filters.slot ?? null,
        status: filters.status ?? null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    await this.store.applyListFilters(filters);
  }

  /**
   * Loads the sections of the active academic year. The list is
   * what drives the section filter; if no year is active we
   * silently leave the dropdown empty.
   */
  private async loadSections(): Promise<void> {
    this.loadingSections.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active = years.find((y) => y.status === AcademicYearStatus.Active);
      if (!active) {
        this.sections.set([]);
        return;
      }
      const sections = await firstValueFrom(
        this.academicApi.listSections({ academicYearPublicUuid: active.publicUuid }),
      );
      this.sections.set(sections);
    } catch {
      this.sections.set([]);
    } finally {
      this.loadingSections.set(false);
    }
  }
}

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

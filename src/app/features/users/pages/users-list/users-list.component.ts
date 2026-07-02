import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { UserRole, UserStatus } from '@core/enums';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  InvitationsTableComponent,
  InviteUserModalComponent,
  UserRoleBadgeComponent,
  UserStatusBadgeComponent,
} from '../../components';
import { InvitationsStore, UsersStore } from '../../store';
import { UserListFilters } from '../../models';

/** URL query-param values for the page tabs. */
type UsersTab = 'users' | 'invitations';

/**
 * `/users` — list page for the user management module.
 *
 * <h3>Layout</h3>
 * Three sections inside the standard {@code PageContainer}:
 *
 * <ol>
 *   <li><b>Filters bar</b> — debounced text search across email/first/last
 *       plus exact-match selects for status and role. Local state lives
 *       in this component; we push the snapshot into the store via
 *       {@link UsersStore#applyFilters}.</li>
 *   <li><b>Table</b> — desktop-first; on small screens the rightmost
 *       columns collapse to a card-style layout. Each row links to
 *       the detail page.</li>
 *   <li><b>Pagination</b> — zero-based prev/next buttons + the
 *       "Página X de Y" indicator. Disabled when the store is loading
 *       so the user can't fire a second request mid-flight.</li>
 * </ol>
 *
 * <h3>Lifecycle</h3>
 * Loads the first page on init; subsequent loads are triggered by the
 * filter / pagination handlers below. The component holds no fetched
 * data of its own — every signal it reads comes from the store.
 */
@Component({
  selector: 'app-users-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    UserRoleBadgeComponent,
    UserStatusBadgeComponent,
    InvitationsTableComponent,
    InviteUserModalComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        title="Usuarios"
        subtitle="Gestiona las cuentas activas del workspace, sus roles y estado de acceso."
      >
        <button type="button" class="btn btn-primary btn-sm" (click)="openInviteModal()">
          <app-icon name="mail" [size]="16" />
          <span class="hidden sm:inline">Invitar</span>
        </button>

        <ng-container secondary>
          <nav
            class="-mb-px flex gap-1 overflow-x-auto"
            role="tablist"
            aria-label="Vistas del módulo de usuarios"
          >
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === 'users'"
              [class]="tabClass('users')"
              (click)="switchTab('users')"
            >
              Usuarios
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === 'invitations'"
              [class]="tabClass('invitations')"
              (click)="switchTab('invitations')"
            >
              Invitaciones
              @if (invitationsBadge() > 0) {
                <span
                  class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-500/15 px-1.5 text-2xs font-semibold text-primary-700 dark:text-primary-300"
                >
                  {{ invitationsBadge() }}
                </span>
              }
            </button>
          </nav>
        </ng-container>
      </app-page-header>

      @if (tab() === 'invitations') {
        <section class="card overflow-hidden">
          <app-invitations-table />
        </section>
      } @else {
        <!-- Filtros -->
        <section class="card mb-4">
          <div class="card-body grid gap-3 sm:grid-cols-12">
            <div class="sm:col-span-6">
              <label class="label" for="users-search">Buscar</label>
              <div class="relative">
                <span
                  class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-content-subtle"
                >
                  <app-icon name="search" [size]="16" />
                </span>
                <input
                  id="users-search"
                  type="search"
                  class="input pl-9"
                  placeholder="Email, nombre o apellido…"
                  [ngModel]="search()"
                  (ngModelChange)="onSearchChange($event)"
                />
              </div>
            </div>

            <div class="sm:col-span-3">
              <label class="label" for="users-status">Estado</label>
              <select
                id="users-status"
                class="select"
                [ngModel]="status()"
                (ngModelChange)="onStatusChange($event)"
              >
                <option [ngValue]="null">Todos</option>
                @for (opt of statusOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <div class="sm:col-span-3">
              <label class="label" for="users-role">Rol</label>
              <select
                id="users-role"
                class="select"
                [ngModel]="role()"
                (ngModelChange)="onRoleChange($event)"
              >
                <option [ngValue]="null">Todos</option>
                @for (opt of roleOptions; track opt.value) {
                  <option [ngValue]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>
          </div>
        </section>

        <!-- Lista -->
        <section class="card overflow-hidden">
          @if (loading() && !hasItems()) {
            <div class="flex items-center justify-center py-16">
              <app-spinner [size]="24" label="Cargando usuarios…" />
            </div>
          } @else if (errorMessage()) {
            <div class="alert alert-danger m-5">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                <p class="font-medium">No pudimos cargar la lista.</p>
                <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">
                Reintentar
              </button>
            </div>
          } @else if (isEmpty()) {
            <app-empty-state
              icon="users"
              title="No encontramos usuarios"
              description="Ajusta los filtros o invita a alguien nuevo (próximamente)."
            />
          } @else {
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th class="min-w-[220px]">Usuario</th>
                    <th class="hidden md:table-cell">Email</th>
                    <th>Roles</th>
                    <th>Estado</th>
                    <th class="hidden lg:table-cell">Último acceso</th>
                    <th class="text-right" aria-label="Acciones"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of items(); track user.publicUuid) {
                    <tr>
                      <td>
                        <a
                          [routerLink]="detailLink(user.publicUuid)"
                          class="block font-medium text-content hover:text-primary-600"
                        >
                          {{ user.fullName || '—' }}
                        </a>
                        <p class="text-xs text-content-muted md:hidden">{{ user.email }}</p>
                      </td>
                      <td class="hidden text-content-muted md:table-cell">{{ user.email }}</td>
                      <td>
                        @if (user.roles.length === 0) {
                          <span class="badge badge-neutral">Sin rol</span>
                        } @else {
                          <div class="flex flex-wrap gap-1.5">
                            @for (r of user.roles; track r) {
                              <app-user-role-badge [role]="r" />
                            }
                          </div>
                        }
                      </td>
                      <td>
                        <app-user-status-badge [status]="user.status" />
                      </td>
                      <td class="hidden text-content-muted lg:table-cell">
                        {{ formatDate(user.lastLoginAt) }}
                      </td>
                      <td class="text-right">
                        <a
                          [routerLink]="detailLink(user.publicUuid)"
                          class="btn btn-ghost btn-sm"
                          aria-label="Ver detalle"
                        >
                          <span class="hidden sm:inline">Ver</span>
                          <app-icon name="chevron-right" [size]="16" />
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <footer
              class="flex flex-col items-center justify-between gap-3 border-t border-border-subtle px-5 py-3 sm:flex-row"
            >
              <p class="text-xs text-content-muted">
                Página
                <span class="font-medium text-content">{{ pagination().page + 1 }}</span>
                de
                <span class="font-medium text-content">{{
                  Math.max(pagination().totalPages, 1)
                }}</span>
                · {{ pagination().totalElements }} usuarios
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  [disabled]="!canPrev() || loading()"
                  (click)="prev()"
                >
                  <app-icon name="chevron-left" [size]="16" />
                  <span class="hidden sm:inline">Anterior</span>
                </button>
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  [disabled]="!canNext() || loading()"
                  (click)="next()"
                >
                  <span class="hidden sm:inline">Siguiente</span>
                  <app-icon name="chevron-right" [size]="16" />
                </button>
              </div>
            </footer>
          }
        </section>
      }

      @if (modalOpen()) {
        <app-invite-user-modal (closed)="closeInviteModal()" />
      }
    </app-page-container>
  `,
})
export class UsersListComponent implements OnInit {
  private readonly store = inject(UsersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly Math = Math;

  /** Local input mirrors so we can debounce / throttle without touching the store. */
  protected readonly search = signal<string>('');
  protected readonly status = signal<UserStatus | null>(null);
  protected readonly role = signal<UserRole | null>(null);

  /** URL-driven tab state — drives both the visible body and the active styling. */
  protected readonly tab = signal<UsersTab>('users');

  /** Local-only modal toggle. Cleared by {@link closeInviteModal} once the
   *  user finishes (success step or cancel). */
  protected readonly modalOpen = signal(false);

  protected readonly items = this.store.items;
  protected readonly hasItems = this.store.hasItems;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly loading = this.store.loading;
  protected readonly pagination = this.store.pagination;
  protected readonly errorMessage = this.store.error;

  /**
   * Pending-invitations counter shown next to the tab label. Reads the
   * invitations store transparently so the badge stays accurate as
   * the admin creates / cancels invitations elsewhere on the page.
   */
  private readonly invitationsStore = inject(InvitationsStore);
  protected readonly invitationsBadge = computed(
    () => this.invitationsStore.pagination().totalElements,
  );

  protected readonly canPrev = computed(() => this.pagination().page > 0);
  protected readonly canNext = computed(() => {
    const { page, totalPages } = this.pagination();
    return page + 1 < totalPages;
  });

  protected readonly statusOptions: ReadonlyArray<{ value: UserStatus; label: string }> = [
    { value: UserStatus.Active, label: 'Activo' },
    { value: UserStatus.Suspended, label: 'Suspendido' },
    { value: UserStatus.Locked, label: 'Bloqueado' },
    { value: UserStatus.Inactive, label: 'Inactivo' },
    { value: UserStatus.PendingVerification, label: 'Pendiente verificación' },
  ];

  protected readonly roleOptions: ReadonlyArray<{ value: UserRole; label: string }> = [
    { value: UserRole.TenantAdmin, label: 'Administrador' },
    { value: UserRole.Staff, label: 'Staff' },
    { value: UserRole.Teacher, label: 'Profesor' },
    { value: UserRole.Student, label: 'Estudiante' },
    { value: UserRole.Guardian, label: 'Tutor' },
  ];

  /**
   * Debounce timer for the text search. Kept as a member so we can
   * cancel it on subsequent keystrokes — restating the timer on every
   * change would fire one request per character.
   */
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    /* Hydrate local inputs from the store state in case we navigate
     * back from the detail page and want to preserve the filters the
     * user had set. */
    const f = this.store.filters();
    this.search.set(f.search ?? '');
    this.status.set(f.status ?? null);
    this.role.set(f.role ?? null);

    /* Hydrate the active tab from the URL so deep links stay
     * shareable. Subsequent toggles also update the URL via
     * {@link #switchTab}. */
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab') === 'invitations' ? 'invitations' : 'users';
      this.tab.set(tab);
    });

    /* If the store was already populated (e.g. navigating back), avoid
     * a redundant fetch — the existing rows are still valid. */
    if (this.store.items().length === 0) {
      void this.store.loadList();
    }
    /* Pre-warm the invitations counter so the tab badge is accurate
     * even before the admin clicks the tab. The store guards against
     * concurrent fetches; calling it here is idempotent. */
    if (this.invitationsStore.items().length === 0) {
      void this.invitationsStore.loadList();
    }
  }

  // ===========================================================================
  // Tabs
  // ===========================================================================

  protected switchTab(target: UsersTab): void {
    if (this.tab() === target) return;
    this.tab.set(target);
    /* Replace the URL — keeps the navigation history clean (admins
     * shouldn't have to press the back button N times to leave the
     * users page). */
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: target === 'users' ? null : target },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected tabClass(target: UsersTab): string {
    const base =
      'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors';
    return this.tab() === target
      ? `${base} border-primary-500 text-primary-700 dark:text-primary-300`
      : `${base} border-transparent text-content-muted hover:text-content`;
  }

  // ===========================================================================
  // Invite modal
  // ===========================================================================

  protected openInviteModal(): void {
    /* Always start from a clean slate — clear any stale "lastCreated"
     * the store may be holding from a previous session so the modal
     * opens on the form step, not the success step. */
    this.invitationsStore.clearLastCreated();
    this.invitationsStore.clearError();
    this.modalOpen.set(true);
  }

  protected closeInviteModal(): void {
    this.modalOpen.set(false);
  }

  protected onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.applyFilters(), 350);
  }

  protected onStatusChange(value: UserStatus | null): void {
    this.status.set(value);
    void this.applyFilters();
  }

  protected onRoleChange(value: UserRole | null): void {
    this.role.set(value);
    void this.applyFilters();
  }

  protected prev(): void {
    void this.store.goToPage(this.pagination().page - 1);
  }

  protected next(): void {
    void this.store.goToPage(this.pagination().page + 1);
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadList();
  }

  protected detailLink(publicUuid: string): string {
    return ROUTES.USERS.detail(publicUuid);
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async applyFilters(): Promise<void> {
    const filters: UserListFilters = {
      search: this.search().trim() || undefined,
      status: this.status() ?? undefined,
      role: this.role() ?? undefined,
    };
    await this.store.applyFilters(filters);
  }
}

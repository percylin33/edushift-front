import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Gender } from '@core/enums';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import {
  EmploymentStatusBadgeComponent,
  InviteTeacherDialogComponent,
  LinkUserDialogComponent,
  TeacherAssignmentsTabComponent,
  TeacherScheduleTabComponent
} from '../../components';
import { TeachersStore } from '../../store';
import { EMPLOYMENT_STATUS_LABELS } from '../../models';

type TabId = 'info' | 'account' | 'assignments' | 'specializations' | 'schedule';

/**
 * `/teachers/:id` — detail page con cuatro tabs.
 *
 * <h3>Tabs</h3>
 * <ol>
 *   <li><b>Info</b> — perfil completo (identificación, contacto,
 *       datos académicos). Read-only; el botón "Editar" lleva al
 *       form compartido.</li>
 *   <li><b>Cuenta</b> — vinculación con un User. Si el docente no
 *       tiene cuenta, ofrece <em>Invitar al sistema</em> (genera link
 *       copiable) o <em>Vincular a usuario existente</em>. Si ya
 *       tiene cuenta, muestra el {@code userPublicUuid} y un link al
 *       perfil de usuario.</li>
 *   <li><b>Asignaciones</b> — lista de
 *       {@code (section, course, period)} a los que el docente está
 *       asignado, con filtros activas/histórico, botón <em>Nueva
 *       asignación</em> (cascada validada) y soft-end con confirm.
 *       FE-4.7 / BE-4.7.</li>
 *   <li><b>Especialidades</b> — chips visibles. Editar via el form
 *       (botón header).</li>
 * </ol>
 *
 * <p>El tab activo se sincroniza con {@code ?tab=…} para que F5 / share
 * de URL preserven la elección.</p>
 */
@Component({
  selector: 'app-teacher-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    EmploymentStatusBadgeComponent,
    InviteTeacherDialogComponent,
    LinkUserDialogComponent,
    TeacherAssignmentsTabComponent,
    TeacherScheduleTabComponent
  ],
  template: `
    <app-page-container size="wide">
      @if (teacher(); as t) {
        <app-page-header [title]="t.fullName" [subtitle]="subtitle(t)">
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">
            <app-icon name="chevron-left" [size]="16" />
            <span>Volver</span>
          </a>
          <a [routerLink]="editRoute(t.publicUuid)" class="btn btn-outline btn-sm">
            <app-icon name="edit-2" [size]="16" />
            <span class="hidden sm:inline">Editar</span>
          </a>
          <button
            type="button"
            class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
            [disabled]="saving()"
            (click)="onDelete()"
          >
            <app-icon name="trash-2" [size]="16" />
            <span class="hidden sm:inline">Eliminar</span>
          </button>
        </app-page-header>

        <!-- Tabs -->
        <nav
          class="mb-4 flex gap-1 border-b border-border-subtle"
          role="tablist"
          aria-label="Detalle del docente"
        >
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === tab.id"
              class="relative px-4 py-2 text-sm font-medium transition-colors"
              [class.text-primary-600]="activeTab() === tab.id"
              [class.text-content-muted]="activeTab() !== tab.id"
              (click)="setTab(tab.id)"
            >
              {{ tab.label }}
              @if (activeTab() === tab.id) {
                <span class="absolute -bottom-px left-0 right-0 h-0.5 bg-primary-600"></span>
              }
            </button>
          }
        </nav>

        @switch (activeTab()) {
          @case ('info') {
            <section class="grid gap-4 md:grid-cols-2">
              <article class="card">
                <header class="card-header">
                  <h3 class="card-title">Identificación</h3>
                </header>
                <dl class="card-body grid grid-cols-3 gap-y-3 text-sm">
                  <dt class="text-content-muted">Documento</dt>
                  <dd class="col-span-2 font-mono">
                    {{ t.documentType }} · {{ t.documentNumber }}
                  </dd>
                  <dt class="text-content-muted">Nombres</dt>
                  <dd class="col-span-2">{{ t.firstName }}</dd>
                  <dt class="text-content-muted">Apellidos</dt>
                  <dd class="col-span-2">
                    {{ t.lastName }}
                    @if (t.secondLastName) { · {{ t.secondLastName }} }
                  </dd>
                  <dt class="text-content-muted">Nacimiento</dt>
                  <dd class="col-span-2">{{ formatDate(t.birthDate) }}</dd>
                  <dt class="text-content-muted">Género</dt>
                  <dd class="col-span-2">{{ genderLabel(t.gender) }}</dd>
                </dl>
              </article>

              <article class="card">
                <header class="card-header">
                  <h3 class="card-title">Contacto</h3>
                </header>
                <dl class="card-body grid grid-cols-3 gap-y-3 text-sm">
                  <dt class="text-content-muted">Email</dt>
                  <dd class="col-span-2">{{ t.email ?? '—' }}</dd>
                  <dt class="text-content-muted">Teléfono</dt>
                  <dd class="col-span-2">{{ t.phone ?? '—' }}</dd>
                </dl>
              </article>

              <article class="card md:col-span-2">
                <header class="card-header">
                  <h3 class="card-title">Datos académicos</h3>
                </header>
                <dl class="card-body grid grid-cols-4 gap-y-3 text-sm">
                  <dt class="text-content-muted">Título</dt>
                  <dd class="col-span-3">{{ t.title ?? '—' }}</dd>
                  <dt class="text-content-muted">Contratación</dt>
                  <dd class="col-span-3">{{ formatDate(t.hireDate) }}</dd>
                  <dt class="text-content-muted">Estado laboral</dt>
                  <dd class="col-span-3">
                    <app-employment-status-badge [status]="t.employmentStatus" />
                  </dd>
                </dl>
              </article>
            </section>
          }
          @case ('account') {
            <section class="card">
              <div class="card-body grid gap-4">
                @if (t.hasUserAccount && t.userPublicUuid) {
                  <div class="alert alert-success">
                    <app-icon name="check" [size]="18" />
                    <p class="flex-1 text-sm">
                      Cuenta vinculada al usuario
                      <code class="font-mono">{{ t.userPublicUuid }}</code>.
                      El docente puede iniciar sesión.
                    </p>
                    <a
                      [routerLink]="userDetailRoute(t.userPublicUuid)"
                      class="btn btn-ghost btn-sm"
                    >
                      Ver usuario
                      <app-icon name="chevron-right" [size]="16" />
                    </a>
                  </div>
                } @else {
                  <div class="rounded-md border border-dashed border-border p-4">
                    <p class="text-sm font-medium text-content">
                      Aún no tiene cuenta de usuario
                    </p>
                    <p class="mt-1 text-xs text-content-muted">
                      Hay dos formas de habilitarle el acceso al sistema:
                    </p>
                    <ul class="mt-3 space-y-2 text-sm">
                      <li class="flex gap-2">
                        <strong class="text-primary-600">1.</strong>
                        <span>
                          <strong>Invitar al sistema</strong> — generamos un
                          enlace que el docente abre y crea su contraseña.
                          Al aceptar, queda vinculado automáticamente.
                        </span>
                      </li>
                      <li class="flex gap-2">
                        <strong class="text-primary-600">2.</strong>
                        <span>
                          <strong>Vincular a usuario existente</strong> —
                          si el docente ya tiene cuenta (porque era admin
                          o staff), buscamos al user con rol
                          <em>Profesor</em> y los conectamos.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      [disabled]="!t.email || saving() || inviting()"
                      [title]="!t.email ? 'Agrega un email primero' : ''"
                      (click)="openInviteDialog()"
                    >
                      <app-icon name="mail" [size]="16" />
                      <span>Invitar al sistema</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline btn-sm"
                      [disabled]="saving() || inviting()"
                      (click)="openLinkDialog()"
                    >
                      <app-icon name="users" [size]="16" />
                      <span>Vincular a usuario existente</span>
                    </button>
                  </div>
                }
              </div>
            </section>
          }
          @case ('assignments') {
            <app-teacher-assignments-tab [teacher]="t" />
          }
          @case ('schedule') {
            <app-teacher-schedule-tab [teacherPublicUuid]="t.publicUuid" />
          }
          @case ('specializations') {
            <section class="card">
              <header class="card-header">
                <div>
                  <h3 class="card-title">Especialidades</h3>
                  <p class="card-description">
                    Áreas de docencia. Se usan en filtros y en las
                    sugerencias de asignaciones.
                  </p>
                </div>
                <a [routerLink]="editRoute(t.publicUuid)" class="btn btn-outline btn-sm">
                  <app-icon name="edit-2" [size]="16" />
                  <span class="hidden sm:inline">Editar</span>
                </a>
              </header>
              <div class="card-body">
                @if (t.specializations.length === 0) {
                  <p class="text-sm text-content-muted">
                    Aún no hay especialidades registradas.
                  </p>
                } @else {
                  <div class="flex flex-wrap gap-2">
                    @for (s of t.specializations; track s) {
                      <span class="badge badge-primary">{{ s }}</span>
                    }
                  </div>
                }
              </div>
            </section>
          }
        }

        @if (showInviteDialog()) {
          <app-invite-teacher-dialog
            [teacher]="t"
            (closed)="closeInviteDialog()"
            (invited)="onInvited()"
          />
        }
        @if (showLinkDialog()) {
          <app-link-user-dialog
            [teacher]="t"
            (closed)="closeLinkDialog()"
            (linked)="onLinked()"
          />
        }
      } @else if (loadingDetail()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando docente…" />
        </div>
      } @else {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar el docente.</p>
            <p class="mt-1 text-xs opacity-80">
              {{ errorMessage() ?? 'El recurso no existe o no tienes permiso.' }}
            </p>
          </div>
          <a [routerLink]="listRoute" class="btn btn-ghost btn-sm">Volver al listado</a>
        </div>
      }
    </app-page-container>
  `
})
export class TeacherDetailComponent implements OnInit {
  private readonly store = inject(TeachersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly listRoute = ROUTES.TEACHERS.LIST;

  protected readonly teacher = this.store.selected;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly saving = this.store.saving;
  protected readonly inviting = this.store.inviting;
  protected readonly errorMessage = this.store.error;

  protected readonly activeTab = signal<TabId>('info');
  protected readonly showInviteDialog = signal<boolean>(false);
  protected readonly showLinkDialog = signal<boolean>(false);

  protected readonly tabs: ReadonlyArray<{ id: TabId; label: string }> = [
    { id: 'info',            label: 'Información' },
    { id: 'account',         label: 'Cuenta' },
    { id: 'assignments',     label: 'Asignaciones' },
    { id: 'specializations', label: 'Especialidades' },
    { id: 'schedule',        label: 'Horario' }
  ];

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigate([ROUTES.TEACHERS.LIST]);
      return;
    }

    /* Si el store ya tiene cargado este detalle (back desde edit), no
     * recargamos para que el flicker sea mínimo. */
    if (this.store.selected()?.publicUuid !== id) {
      await this.store.loadDetail(id);
    }

    const qpTab = this.route.snapshot.queryParamMap.get('tab') as TabId | null;
    if (qpTab && this.isValidTab(qpTab)) {
      this.activeTab.set(qpTab);
    }
  }

  // ===========================================================================
  // UI handlers
  // ===========================================================================

  protected setTab(tab: TabId): void {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  protected openInviteDialog(): void {
    this.store.clearError();
    this.showInviteDialog.set(true);
  }

  protected closeInviteDialog(): void {
    this.showInviteDialog.set(false);
  }

  protected onInvited(): void {
    /* Mantener abierto el dialog para que el admin vea el link
     * copiable; el {@code (closed)} del dialog finaliza el flow. */
  }

  protected openLinkDialog(): void {
    this.store.clearError();
    this.showLinkDialog.set(true);
  }

  protected closeLinkDialog(): void {
    this.showLinkDialog.set(false);
  }

  protected onLinked(): void {
    /* El store ya actualizó {@code selected} via {@code linkUser}.
     * Cerramos el dialog y dejamos que el tab Cuenta pinte el nuevo
     * estado. */
    this.showLinkDialog.set(false);
  }

  protected async onDelete(): Promise<void> {
    const t = this.teacher();
    if (!t) return;
    const ok = confirm(
      `¿Eliminar al docente "${t.fullName}"?\n\n` +
        'Si tiene asignaciones activas, el backend rechazará la eliminación.\n' +
        'En ese caso, finaliza las asignaciones primero desde la pestaña\n' +
        '"Asignaciones" antes de reintentar.'
    );
    if (!ok) return;
    const success = await this.store.delete(t.publicUuid);
    if (success) await this.router.navigate([ROUTES.TEACHERS.LIST]);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected editRoute(publicUuid: string): string {
    return ROUTES.TEACHERS.edit(publicUuid);
  }

  protected userDetailRoute(userPublicUuid: string): string {
    return ROUTES.USERS.detail(userPublicUuid);
  }

  protected subtitle(t: { documentType: string; documentNumber: string; title?: string }): string {
    const doc = `${t.documentType} · ${t.documentNumber}`;
    return t.title ? `${t.title} · ${doc}` : doc;
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  protected genderLabel(gender: Gender | undefined): string {
    if (!gender) return '—';
    switch (gender) {
      case Gender.Female:       return 'Femenino';
      case Gender.Male:         return 'Masculino';
      case Gender.Other:        return 'Otro';
      case Gender.NotSpecified: return 'Sin especificar';
    }
  }

  private isValidTab(value: string): value is TabId {
    return ['info', 'account', 'assignments', 'specializations', 'schedule'].includes(value);
  }
}

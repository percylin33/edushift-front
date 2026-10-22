import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminTenantSummary } from '../../models';
import { AdminImpersonationService, SupportUserOption } from '../../services';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold text-white">Soporte de usuarios</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-400">Busca el colegio y el usuario para abrir una sesión temporal de soporte. Cada inicio queda registrado en auditoría y la sesión expira automáticamente.</p>
      @if (impersonation.error(); as error) { <p class="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">{{ error }}</p> }
      @if (lookupError(); as error) { <p class="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">{{ error }}</p> }
      @if (impersonation.active(); as active) {
        <section class="mt-5 rounded-xl border border-amber-800 bg-amber-950/40 p-5 text-amber-100"><h2 class="font-semibold">Sesión activa</h2><p class="mt-2 text-sm">{{ active.fullName }} · {{ active.email }} · {{ active.tenantSlug }}</p><p class="mt-1 text-xs text-amber-300">Motivo: {{ active.reason }}</p><button (click)="impersonation.stop()" [disabled]="impersonation.busy()" class="mt-4 rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950">Terminar sesión de soporte</button></section>
      } @else {
        <section class="mt-5 max-w-2xl space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <label for="school-search" class="block text-sm text-slate-300">Colegio</label>
            <div class="mt-1 flex gap-2">
              <input id="school-search" [(ngModel)]="schoolSearch" (keydown.enter)="searchSchools()" class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Escribe el nombre del colegio" />
              <button type="button" (click)="searchSchools()" [disabled]="schoolsLoading() || !schoolSearch.trim()" class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">{{ schoolsLoading() ? 'Buscando…' : 'Buscar' }}</button>
            </div>
            @if (schools().length) {
              <select class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" [ngModel]="selectedSchoolUuid()" (ngModelChange)="selectSchool($event)">
                <option value="">Selecciona un colegio</option>
                @for (school of schools(); track school.publicUuid) { <option [value]="school.publicUuid">{{ school.name }} · {{ school.slug }}</option> }
              </select>
            } @else if (schoolsSearched() && !schoolsLoading()) {
              <p class="mt-2 text-xs text-slate-500">No se encontraron colegios activos con ese nombre.</p>
            }
          </div>

          @if (selectedSchoolUuid()) {
            <div>
              <label for="user-search" class="block text-sm text-slate-300">Usuario del colegio seleccionado</label>
              <div class="mt-1 flex gap-2">
                <input id="user-search" [(ngModel)]="userSearch" (keydown.enter)="searchUsers()" class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Buscar por nombre o correo" />
                <button type="button" (click)="searchUsers()" [disabled]="usersLoading()" class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">{{ usersLoading() ? 'Buscando…' : 'Buscar' }}</button>
              </div>
              <select [(ngModel)]="targetUuid" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                <option value="">Selecciona un usuario activo</option>
                @for (user of users(); track user.publicUuid) { <option [value]="user.publicUuid">{{ user.fullName }} · {{ user.email }} · {{ user.roles.join(', ') }}</option> }
              </select>
              @if (!users().length && usersSearched() && !usersLoading()) { <p class="mt-2 text-xs text-slate-500">No se encontraron usuarios activos para ese criterio.</p> }
            </div>
          }

          <div>
            <label for="support-reason" class="block text-sm text-slate-300">Motivo del soporte<textarea id="support-reason" [(ngModel)]="reason" maxlength="500" rows="3" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Describe el caso que necesitas reproducir"></textarea></label>
            <button type="button" (click)="start()" [disabled]="!targetUuid || !reason.trim() || impersonation.busy()" class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{{ impersonation.busy() ? 'Validando…' : 'Iniciar sesión temporal' }}</button>
          </div>
          <p class="text-xs text-slate-500">Solo aparecen colegios y usuarios activos. No se permite impersonar tu propia cuenta ni cuentas Super Admin.</p>
        </section>
      }
    </div>
  `,
})
export class AdminSupportComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly impersonation = inject(AdminImpersonationService);
  protected readonly schools = signal<AdminTenantSummary[]>([]);
  protected readonly users = signal<SupportUserOption[]>([]);
  protected readonly selectedSchoolUuid = signal('');
  protected readonly schoolsLoading = signal(false);
  protected readonly usersLoading = signal(false);
  protected readonly schoolsSearched = signal(false);
  protected readonly usersSearched = signal(false);
  protected readonly lookupError = signal<string | null>(null);
  protected schoolSearch = '';
  protected userSearch = '';
  protected targetUuid = '';
  protected reason = '';

  constructor() {
    const tenantUuid = this.route.snapshot.queryParamMap.get('tenant');
    const tenantName = this.route.snapshot.queryParamMap.get('tenantName');
    if (tenantUuid && tenantName) {
      this.schoolSearch = tenantName;
      this.searchSchools(tenantUuid);
    }
  }

  protected searchSchools(preselectedTenantUuid?: string): void {
    if (!this.schoolSearch.trim()) return;
    this.schoolsLoading.set(true);
    this.lookupError.set(null);
    this.selectedSchoolUuid.set('');
    this.users.set([]);
    this.targetUuid = '';
    this.impersonation.searchTenants(this.schoolSearch).subscribe({
      next: (response) => {
        const schools = response.data.content ?? [];
        this.schools.set(schools);
        this.schoolsSearched.set(true);
        this.schoolsLoading.set(false);
        const selectedSchool = preselectedTenantUuid
          ? schools.find((school) => school.publicUuid === preselectedTenantUuid)
          : undefined;
        if (selectedSchool) this.selectSchool(selectedSchool.publicUuid);
      },
      error: () => {
        this.lookupError.set('No se pudieron buscar colegios. Inténtalo nuevamente.');
        this.schoolsLoading.set(false);
      },
    });
  }

  protected selectSchool(tenantUuid: string): void {
    this.selectedSchoolUuid.set(tenantUuid);
    this.userSearch = '';
    this.targetUuid = '';
    this.users.set([]);
    this.usersSearched.set(false);
    if (tenantUuid) this.searchUsers();
  }

  protected searchUsers(): void {
    const tenantUuid = this.selectedSchoolUuid();
    if (!tenantUuid) return;
    this.usersLoading.set(true);
    this.lookupError.set(null);
    this.targetUuid = '';
    this.impersonation.searchUsers(tenantUuid, this.userSearch).subscribe({
      next: (response) => {
        this.users.set(response.data.content ?? []);
        this.usersSearched.set(true);
        this.usersLoading.set(false);
      },
      error: () => {
        this.lookupError.set('No se pudieron buscar usuarios en ese colegio. Inténtalo nuevamente.');
        this.usersLoading.set(false);
      },
    });
  }

  protected start(): void {
    this.impersonation.start(this.targetUuid, this.reason);
  }
}

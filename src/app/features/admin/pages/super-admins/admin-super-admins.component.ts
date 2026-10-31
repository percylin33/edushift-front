import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services';
import { AdminSuperAdminsService, SuperAdminAccount } from '../../services';

@Component({
  selector: 'app-admin-super-admins',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <header class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-2xl font-bold text-white">Cuentas de plataforma</h1><p class="mt-1 text-sm text-slate-400">Administra quién puede operar la consola Super Admin.</p></div><button (click)="showCreate.set(true)" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Crear cuenta</button></header>
      <p class="mt-4 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">Las cuentas nuevas deben completar el enrolamiento MFA al primer ingreso. Coordina la entrega de acceso por el canal seguro de operaciones.</p>
      @if (svc.error(); as error) { <p class="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">{{ error }}</p> }
      <div class="mt-5 overflow-x-auto rounded-xl border border-slate-800"><table class="w-full text-left text-sm"><thead class="bg-slate-900 text-xs uppercase text-slate-400"><tr><th class="px-4 py-3">Nombre</th><th class="px-4 py-3">Correo</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">MFA</th><th class="px-4 py-3">Último acceso</th><th class="px-4 py-3">Acción</th></tr></thead><tbody class="divide-y divide-slate-800">
      @for (account of svc.accounts(); track account.publicUuid) { <tr><td class="px-4 py-3 text-white">{{ account.firstName }} {{ account.lastName }}</td><td class="px-4 py-3 text-slate-300">{{ account.email }}</td><td class="px-4 py-3">{{ account.status }}</td><td class="px-4 py-3" [class.text-emerald-300]="account.mfaEnabled" [class.text-amber-300]="!account.mfaEnabled">{{ account.mfaEnabled ? 'Activa' : 'Pendiente' }}</td><td class="px-4 py-3 text-slate-400">{{ account.lastLoginAt ?? 'Nunca' }}</td><td class="px-4 py-3"><button (click)="disable(account)" [disabled]="account.status !== 'ACTIVE' || account.publicUuid === currentUserId() || svc.activeCount() <= 1" class="text-red-300 disabled:cursor-not-allowed disabled:opacity-40">Desactivar</button></td></tr> }
      @empty { <tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">{{ svc.loading() ? 'Cargando…' : 'No hay cuentas.' }}</td></tr> }
      </tbody></table></div>
      <p class="mt-3 text-xs text-slate-500">Administradores activos: {{ svc.activeCount() }}. Debe permanecer al menos una cuenta activa.</p>
      @if (showCreate()) { <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section class="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6"><h2 class="text-lg font-semibold text-white">Nueva cuenta Super Admin</h2><label class="mt-4 block text-sm text-slate-300">Correo<input type="email" [(ngModel)]="email" class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" /></label><div class="mt-3 grid grid-cols-2 gap-3"><label class="text-sm text-slate-300">Nombre<input [(ngModel)]="firstName" class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" /></label><label class="text-sm text-slate-300">Apellido<input [(ngModel)]="lastName" class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2" /></label></div><div class="mt-5 flex justify-end gap-2"><button (click)="showCreate.set(false)" class="rounded border border-slate-700 px-4 py-2 text-slate-300">Cancelar</button><button (click)="create()" [disabled]="!email.trim() || !firstName.trim() || !lastName.trim()" class="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-40">Crear</button></div></section></div> }
    </div>
  `,
})
export class AdminSuperAdminsComponent implements OnInit {
  protected readonly svc = inject(AdminSuperAdminsService);
  private readonly auth = inject(AuthService);
  protected readonly showCreate = signal(false);
  protected email = '';
  protected firstName = '';
  protected lastName = '';
  protected currentUserId(): string | undefined { return this.auth.user()?.publicUuid; }
  ngOnInit(): void { this.svc.load(); }
  protected create(): void {
    const request = { email: this.email.trim(), firstName: this.firstName.trim(), lastName: this.lastName.trim() };
    this.svc.create(request);
    this.email = ''; this.firstName = ''; this.lastName = ''; this.showCreate.set(false);
  }
  protected disable(account: SuperAdminAccount): void {
    if (account.publicUuid === this.currentUserId() || this.svc.activeCount() <= 1) return;
    if (window.confirm(`¿Desactivar la cuenta de ${account.email}?`)) this.svc.disable(account.publicUuid);
  }
}

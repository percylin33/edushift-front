import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';

@Component({
  selector: 'app-admissions-navigation',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      aria-label="Secciones de admisiones"
      class="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700"
    >
      <a
        routerLink="/admissions"
        [queryParams]="{ yearId: year() }"
        routerLinkActive="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
        [routerLinkActiveOptions]="{ exact: true }"
        class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >Inicio</a
      >
      @if (canReadInquiries()) {
        <a
          routerLink="/admissions/inquiries"
          [queryParams]="{ yearId: year() }"
          routerLinkActive="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
          class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >Consultas</a
        >
      }
      @if (canReadApplications()) {
        <a
          routerLink="/admissions/applications"
          [queryParams]="{ yearId: year() }"
          routerLinkActive="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
          class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >Solicitudes</a
        >
        <a
          routerLink="/admissions/vacancies"
          [queryParams]="{ yearId: year() }"
          routerLinkActive="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
          class="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >Vacantes</a
        >
      }
    </nav>
  `,
})
export class AdmissionsNavigationComponent {
  readonly year = input('');
  private readonly auth = inject(AuthService);
  canReadInquiries(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsInquiriesRead)
    );
  }
  canReadApplications(): boolean {
    return (
      this.auth.hasPermission(Permission.LmsAdmissionManage) ||
      this.auth.hasPermission(Permission.AdmissionsApplicationsRead)
    );
  }
}

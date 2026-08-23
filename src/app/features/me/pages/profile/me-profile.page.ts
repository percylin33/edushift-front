import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Permission } from '@core/enums';
import { AuthService } from '@core/services';
import { MeProfile } from '../../models/me-profile.model';
import { MeApiService } from '../../services/me-api.service';

/**
 * STUDENT personal profile page (DEBT-STUDENT-PRIVACY / Fase 1).
 *
 * <p>Renders the full {@link MeProfile} envelope: avatar (initials),
 * display name, section / grade / academic year badges, tenant
 * branding, and the list of granted {@code ME_*} authorities. The
 * sub-section tiles mirror the sidebar so the user can navigate from
 * a single page without going back to the dashboard.</p>
 */
@Component({
  selector: 'app-me-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      @if (loading()) {
        <div class="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else if (error()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (profile()) {
        @let p = profile()!;
        <header class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div class="flex items-start gap-5">
            <div
              aria-hidden="true"
              class="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {{ initials(p) }}
            </div>
            <div class="flex-1">
              <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                Mi espacio
              </p>
              <h1 class="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {{ p.firstName }} {{ p.lastName }}
              </h1>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {{ p.email || 'Sin correo registrado' }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                @if (p.gradeName) {
                  <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                    {{ p.gradeName }}
                  </span>
                }
                @if (p.sectionName) {
                  <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                    Sección {{ p.sectionName }}
                  </span>
                }
                @if (p.academicYearLabel) {
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Año académico {{ p.academicYearLabel }}
                  </span>
                }
              </div>
            </div>
          </div>
        </header>

        <section aria-label="Accesos rápidos" class="mt-8">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Mis accesos
          </h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @if (auth.hasPermission(Permission.MeRead)) {
              <a routerLink="/me/courses" class="card transition hover:ring-2 hover:ring-indigo-400">
                <div class="card-body">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-100">Mis cursos</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Materiales, tareas y quizzes.
                  </p>
                </div>
              </a>
              <a routerLink="/me/schedule" class="card transition hover:ring-2 hover:ring-indigo-400">
                <div class="card-body">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-100">Mi horario</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Horario semanal de tus cursos.
                  </p>
                </div>
              </a>
              <a routerLink="/me/grades" class="card transition hover:ring-2 hover:ring-indigo-400">
                <div class="card-body">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-100">Mis notas</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Calificaciones por curso y periodo.
                  </p>
                </div>
              </a>
            }
            @if (auth.hasPermission(Permission.MeAttendanceRead)) {
              <a routerLink="/me/attendance" class="card transition hover:ring-2 hover:ring-emerald-400">
                <div class="card-body">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-100">Mi asistencia</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Historial y justificaciones.
                  </p>
                </div>
              </a>
            }
            @if (auth.hasPermission(Permission.MeQrRead)) {
              <a routerLink="/me/qr" class="card transition hover:ring-2 hover:ring-indigo-400">
                <div class="card-body">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-100">Mi QR</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Credencial imprimible.
                  </p>
                </div>
              </a>
            }
            @if (auth.hasPermission(Permission.MePaymentsRead)) {
              <a routerLink="/me/payments" class="card transition hover:ring-2 hover:ring-emerald-400">
                <div class="card-body">
                  <h3 class="font-semibold text-slate-900 dark:text-slate-100">Mis pagos</h3>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Cuotas, estados y comprobantes.
                  </p>
                </div>
              </a>
            }
          </div>
        </section>
      }
    </section>
  `,
})
export class MeProfilePageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  readonly profile = signal<MeProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Re-exported so the template can reference the enum values directly. */
  protected readonly Permission = Permission;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.profile.set(response.data ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            'No se pudo cargar tu perfil personal. Vuelve a intentarlo en unos minutos.',
          );
          this.loading.set(false);
        },
      });
  }

  initials(p: MeProfile): string {
    const a = p.firstName?.[0] ?? '';
    const b = p.lastName?.[0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
}

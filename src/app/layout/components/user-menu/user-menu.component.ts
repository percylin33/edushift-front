import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components';
import { InitialsPipe } from '@shared/pipes';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { AuthApiService } from '@features/auth/services/auth-api.service';

/**
 * User dropdown anchored to the navbar. Click-outside is handled by a full
 * viewport backdrop (button) so we don't ship a global outside-click directive.
 */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, InitialsPipe],
  template: `
    <div class="relative">
      <button
        type="button"
        class="flex items-center gap-2 rounded-md p-1.5 text-content
               hover:bg-surface-muted
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        (click)="toggle()"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/15 text-xs font-semibold text-primary-700 dark:text-primary-300"
        >
          {{ fullName() | initials }}
        </span>
        <span class="hidden flex-col items-start text-left leading-tight sm:flex">
          <span class="max-w-[10rem] truncate text-sm font-medium">{{ fullName() }}</span>
          @if (subtitle(); as sub) {
            <span class="max-w-[10rem] truncate text-2xs text-content-subtle">{{ sub }}</span>
          }
        </span>
        <app-icon name="chevron-down" [size]="16" class="text-content-subtle" />
      </button>

      @if (open()) {
        <button
          type="button"
          class="fixed inset-0 z-30"
          aria-hidden="true"
          tabindex="-1"
          (click)="close()"
        ></button>

        <div
          class="absolute right-0 z-40 mt-2 w-60 origin-top-right animate-fade-in
                 rounded-lg border border-border bg-surface-raised p-1 shadow-soft-lg"
          role="menu"
        >
          <div class="border-b border-border-subtle px-3 py-2">
            <p class="truncate text-sm font-medium text-content">{{ fullName() }}</p>
            @if (email(); as e) {
              <p class="truncate text-xs text-content-subtle">{{ e }}</p>
            }
          </div>

          <a
            [routerLink]="['/profile']"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-content
                   hover:bg-surface-muted"
            (click)="close()"
          >
            <app-icon name="user" [size]="16" class="text-content-subtle" />
            Perfil
          </a>
          <a
            [routerLink]="['/settings']"
            role="menuitem"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-content
                   hover:bg-surface-muted"
            (click)="close()"
          >
            <app-icon name="settings" [size]="16" class="text-content-subtle" />
            Configuración
          </a>

          <div class="my-1 h-px bg-border-subtle"></div>

          @if (isAuthenticated()) {
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger
                     hover:bg-danger/10"
              (click)="signOut()"
            >
              <app-icon name="log-out" [size]="16" />
              Cerrar sesión
            </button>
          } @else {
            <a
              [routerLink]="loginRoute"
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-primary-700
                     dark:text-primary-300 hover:bg-surface-muted"
              (click)="close()"
            >
              <app-icon name="log-in" [size]="16" />
              Iniciar sesión
            </a>
          }
        </div>
      }
    </div>
  `
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();

  readonly isAuthenticated = this.auth.isAuthenticated;
  /* `fullName` from the backend is the canonical display name (first + last
   * already concatenated server-side). Falls back to email if the user
   * arrived via a `UserSummary` that hadn't been enriched yet. */
  readonly fullName = computed(() => {
    const user = this.auth.user();
    if (!user) return 'Invitado';
    return user.fullName?.trim() || user.email;
  });
  readonly subtitle = computed(() => this.auth.user()?.roles?.[0] ?? null);
  readonly email = computed(() => this.auth.user()?.email ?? null);

  readonly loginRoute = ROUTES.AUTH.LOGIN;

  toggle(): void { this._open.update((v) => !v); }
  close(): void { this._open.set(false); }

  /**
   * Logout flow:
   * <ol>
   *   <li>Best-effort revoke the refresh token server-side so it can no
   *       longer rotate (the backend treats this as idempotent — see
   *       {@code docs/modules/auth.md} §2.3).</li>
   *   <li>Wipe the local session unconditionally — even if the HTTP call
   *       failed (network down, server restarting). Logout is a user
   *       intent we never want to fail them out of.</li>
   *   <li>Bounce to the login screen.</li>
   * </ol>
   * The HTTP call doesn't block the UI: we navigate as soon as the local
   * session is cleared. The fire-and-forget subscribe is acceptable here
   * because the response is 204 with no payload either way.
   */
  signOut(): void {
    const refresh = this.auth.refreshToken();
    const finishLocally = () => {
      this.auth.clearSession();
      this.close();
      this.router.navigate([this.loginRoute]);
    };

    if (!refresh) {
      finishLocally();
      return;
    }

    this.authApi.logout(refresh).subscribe({
      complete: () => finishLocally(),
      error: () => finishLocally()
    });
  }
}

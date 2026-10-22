import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { API } from '@core/constants';
import { TenantService } from '@core/services';
import { APP } from '@core/constants';
import { TenantStatus } from '@core/enums';
import { Tenant } from '@core/models';
import {
  PLATFORM_DEFAULT_LOGO_DARK_URL,
  PLATFORM_DEFAULT_LOGO_URL,
  TenantAssetsService,
} from '@core/theming/tenant-assets.service';
import { AlertComponent, SpinnerComponent, TenantLogoComponent } from '@shared/components';
import { ThemeToggleComponent } from '../components';
import { PrivacyNoticeBannerComponent } from '@shared/components/privacy-notice-banner/privacy-notice-banner.component';

type AuthShellState = 'loading' | 'ready' | 'needs-link' | 'not-found' | 'inactive';

/**
 * Public auth shell (login, forgot password, MFA, register).
 *
 * <h3>School-first branding</h3>
 * When the URL resolves a tenant ({@code ?tenant=} / subdomain) and
 * {@code GET /tenants/by-slug} hydrates successfully, the shell paints the
 * school's logo, name, primary color and {@code loginBgUrl}. Missing logo or
 * background fall back to platform defaults. EduShift appears only as a
 * subtle "Powered by" mark.
 *
 * <h3>Gate without URL identity</h3>
 * Institution identity comes from the URL alone (Phase 1). If the slug was
 * not resolved from query/subdomain (or hydration failed), login /
 * forgot-password / MFA challenge show a gate instead of a blind form.
 * {@code /auth/register} and {@code /auth/mfa-enroll} stay reachable.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    ThemeToggleComponent,
    TenantLogoComponent,
    AlertComponent,
    SpinnerComponent,
    PrivacyNoticeBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes auth-rise {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes auth-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes auth-drift {
        from {
          transform: scale(1.04) translate3d(0, 0, 0);
        }
        to {
          transform: scale(1.08) translate3d(-1.2%, -0.6%, 0);
        }
      }
      .auth-rise {
        animation: auth-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .auth-rise-delay {
        animation: auth-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
      }
      .auth-fade-delay {
        animation: auth-fade 0.5s ease 0.18s both;
      }
      .auth-footer a {
        color: rgba(255, 255, 255, 0.9);
      }
      .auth-footer a:hover {
        color: white;
      }
      .auth-drift {
        animation: auth-drift 28s ease-in-out infinite alternate;
      }
      @media (prefers-reduced-motion: reduce) {
        .auth-rise,
        .auth-rise-delay,
        .auth-fade-delay,
        .auth-drift {
          animation: none !important;
        }
      }
    `,
  ],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-surface">
      <!-- Privacy notice banner - visible on first ingress -->
      <app-privacy-notice-banner />

      <!-- Full-bleed hero plane -->
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <div class="absolute inset-0" [style.background]="meshBackground()"></div>
        <div
          class="auth-drift absolute inset-0 bg-cover bg-center"
          [style.background-image]="'url(' + loginBgUrl() + ')'"
        ></div>
        <div class="absolute inset-0" [style.background]="heroOverlay()"></div>
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.14),transparent_55%)]"></div>
      </div>

      <div class="relative z-10 grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,28rem)]">
        <!-- Institutional brand column (desktop) -->
        <aside class="relative hidden flex-col justify-between p-10 text-white lg:flex xl:p-14">
          <div class="auth-rise flex items-center gap-4">
            <app-tenant-logo variant="mark" size="xl" />
            <div class="flex min-w-0 flex-col leading-tight">
              <span class="truncate text-2xl font-semibold tracking-tight">{{ tenantName() }}</span>
              <span class="mt-1 text-sm text-white/75">
                {{ showSchoolBrand() ? 'Acceso a la plataforma' : 'Plataforma educativa' }}
              </span>
            </div>
          </div>

          <div class="auth-rise-delay max-w-lg space-y-4">
            @if (shellState() === 'needs-link') {
              <h1 class="text-balance text-4xl font-semibold tracking-tight">
                Abre el enlace de tu institución
              </h1>
              <p class="text-base text-white/80">
                Cada colegio tiene su propia dirección de acceso. Usa el enlace que te compartió tu
                institución para entrar con su identidad visual.
              </p>
            } @else if (shellState() === 'not-found') {
              <h1 class="text-balance text-4xl font-semibold tracking-tight">
                No encontramos esta institución
              </h1>
              <p class="text-base text-white/80">
                El enlace puede estar incompleto o el colegio aún no está activo en EduShift.
              </p>
            } @else if (shellState() === 'inactive') {
              <h1 class="text-balance text-4xl font-semibold tracking-tight">
                Institución no disponible
              </h1>
              <p class="text-base text-white/80">
                {{ tenantName() }} no acepta ingresos en este momento. Contacta a tu administración.
              </p>
            } @else if (showSchoolBrand()) {
              <h1 class="text-balance text-4xl font-semibold tracking-tight">
                {{ welcomeTitle() }}
              </h1>
              <p class="text-base text-white/80">
                {{ welcomeDescription() }}
              </p>
            } @else {
              <h1 class="text-balance text-4xl font-semibold tracking-tight">
                Crea o administra tu institución
              </h1>
              <p class="text-base text-white/80">
                EduShift conecta académico, familia y operaciones en un solo lugar.
              </p>
            }
          </div>

          <div class="auth-fade-delay auth-footer flex items-center gap-2 text-xs text-white/55">
            <span>Powered by</span>
            <img
              [src]="platformWordmarkOnDark"
              alt="EduShift"
              class="h-5 w-auto"
            />
            <span class="text-white/30" aria-hidden="true">·</span>
            <span>© {{ year }}</span>
            <span class="text-white/30" aria-hidden="true">·</span>
            <a
              routerLink="/politica-privacidad"
              class="text-white/90 underline decoration-white/50 transition-colors hover:text-white"
            >
              Privacidad
            </a>
            <span class="text-white/30" aria-hidden="true">·</span>
            <a
              routerLink="/terminos-y-condiciones"
              class="text-white/90 underline decoration-white/50 transition-colors hover:text-white"
            >
              Términos
            </a>
            <span class="text-white/30" aria-hidden="true">·</span>
            <a
              routerLink="/libro-de-reclamaciones"
              class="flex items-center gap-1 text-white/90 underline decoration-white/50 transition-colors hover:text-white"
            >
              📖 Reclamaciones
            </a>
          </div>
        </aside>

        <!-- Form / gate column -->
        <section
          class="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-8"
        >
          <div class="absolute right-4 top-4 z-20">
            <app-theme-toggle />
          </div>

          <div
            class="auth-fade-delay w-full max-w-md rounded-2xl border border-white/10 bg-surface/95 p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-white/5 dark:bg-surface/90 sm:p-8"
          >
            <header class="mb-6 flex flex-col items-center gap-3 text-center lg:hidden">
              <app-tenant-logo variant="mark" size="lg" />
              <div>
                <p class="text-lg font-semibold tracking-tight text-content">{{ tenantName() }}</p>
                <p class="text-xs text-content-muted">
                  {{ showSchoolBrand() ? 'Acceso a la plataforma' : 'Plataforma educativa' }}
                </p>
              </div>
            </header>

            @if (loadError(); as message) {
              <app-alert variant="error" [message]="message" />
            } @else if (showLoadingState() || shellState() === 'loading') {
              <div class="flex items-center justify-center py-12">
                <app-spinner [size]="28" label="Cargando…" />
              </div>
            } @else if (shellState() === 'needs-link') {
              <div class="space-y-4 text-center sm:text-left">
                <h2 class="text-xl font-semibold tracking-tight text-content">
                  Abre el enlace de tu institución
                </h2>
                <p class="text-sm text-content-muted">
                  No podemos identificar tu institución desde este enlace. Pide a tu colegio el
                  enlace correcto para ingresar.
                </p>
              </div>
            } @else if (shellState() === 'not-found') {
              <div class="space-y-3">
                <app-alert
                  variant="error"
                  message="No encontramos una institución con ese identificador."
                />
                <p class="text-sm text-content-muted">
                  Revisa el enlace o pide uno nuevo a tu institución.
                </p>
              </div>
            } @else if (shellState() === 'inactive') {
              <app-alert
                variant="warning"
                message="Esta institución no está activa. Contacta a tu administración."
              />
            } @else {
              <router-outlet />
            }

            <div class="mt-8 flex flex-col items-center justify-center gap-2 text-[11px] text-content-subtle lg:hidden">
              <p class="flex items-center gap-2">
                <span>Powered by</span>
                <img
                  [src]="platformWordmark"
                  alt="EduShift"
                  class="h-4 w-auto dark:hidden"
                />
                <img
                  [src]="platformWordmarkOnDark"
                  alt=""
                  class="hidden h-4 w-auto dark:block"
                />
              </p>
              <div class="flex items-center gap-2">
                <a
                  routerLink="/politica-privacidad"
                  class="hover:text-content underline decoration-content-subtle/50 transition-colors"
                >
                  Política de Privacidad
                </a>
                <span class="text-content-subtle/40">·</span>
                <a
                  routerLink="/terminos-y-condiciones"
                  class="hover:text-content underline decoration-content-subtle/50 transition-colors"
                >
                  Términos y Condiciones
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AuthLayoutComponent {
  private readonly tenant = inject(TenantService);
  private readonly assets = inject(TenantAssetsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly appName = APP.NAME;
  readonly year = new Date().getFullYear();
  /** Platform wordmark on the dark hero. Always EduShift, never the school logo. */
  readonly platformWordmarkOnDark = PLATFORM_DEFAULT_LOGO_DARK_URL;
  /** Color wordmark for the light auth card; the dark variant swaps in with the theme. */
  readonly platformWordmark = PLATFORM_DEFAULT_LOGO_URL;

  readonly loginBgUrl = this.assets.loginBgUrl;
  readonly tenantName = computed(() => {
    const t = this.tenant.tenant();
    if (!t || this.isPlaceholder(t)) return this.appName;
    return t.name || this.appName;
  });
  readonly welcomeTitle = computed(() => {
    const custom = this.assets.loginTitle();
    if (custom) return custom;
    return `Bienvenido a ${this.tenantName()}`;
  });
  readonly welcomeDescription = computed(() => {
    const custom = this.assets.loginDescription();
    if (custom) return custom;
    return 'Ingresa con tu cuenta institucional para continuar.';
  });

  private readonly _routeLoading = signal(false);
  private readonly _loadError = signal<string | null>(null);
  private readonly _url = signal(this.router.url);
  /** Counter of lazy chunk loads since the last NavigationEnd. >0 means we're mid-load. */
  private loadCount = 0;

  readonly showLoadingState = computed(() => this._routeLoading() && !this._loadError());
  readonly loadError = this._loadError.asReadonly();

  readonly shellState = computed<AuthShellState>(() => {
    if (this.isExemptRoute(this._url())) return 'ready';

    const ctx = this.tenant.context();
    const fromUrl =
      ctx.resolvedFrom === 'subdomain' ||
      ctx.resolvedFrom === 'path' ||
      ctx.resolvedFrom === 'header';

    if (!fromUrl) return 'needs-link';

    const t = ctx.tenant;
    if (!t || this.isPlaceholder(t)) return 'not-found';
    if (t.status === TenantStatus.Inactive || t.status === TenantStatus.Suspended) {
      return 'inactive';
    }
    return 'ready';
  });

  readonly showSchoolBrand = computed(() => {
    const ctx = this.tenant.context();
    const fromUrl =
      ctx.resolvedFrom === 'subdomain' ||
      ctx.resolvedFrom === 'path' ||
      ctx.resolvedFrom === 'header';
    const t = ctx.tenant;
    if (!fromUrl || !t || this.isPlaceholder(t)) return false;
    const state = this.shellState();
    return state === 'ready' || state === 'inactive' || this.isExemptRoute(this._url());
  });

  readonly heroOverlay = computed(() => {
    const rgb = this.primaryRgb();
    if (!rgb) {
      return 'linear-gradient(135deg, rgba(15,23,42,0.78) 0%, rgba(15,23,42,0.55) 45%, rgba(15,23,42,0.72) 100%)';
    }
    const { r, g, b } = rgb;
    return `linear-gradient(135deg, rgba(${r},${g},${b},0.88) 0%, rgba(15,23,42,0.55) 48%, rgba(15,23,42,0.78) 100%)`;
  });

  readonly meshBackground = computed(() => {
    const rgb = this.primaryRgb();
    if (!rgb) {
      return `
        radial-gradient(ellipse 80% 60% at 12% 18%, rgba(14, 165, 233, 0.45), transparent 55%),
        radial-gradient(ellipse 70% 50% at 88% 12%, rgba(245, 158, 11, 0.28), transparent 50%),
        radial-gradient(ellipse 60% 45% at 70% 88%, rgba(15, 23, 42, 0.35), transparent 55%),
        linear-gradient(155deg, #0f172a 0%, #164e63 48%, #0c4a6e 100%)
      `;
    }
    const { r, g, b } = rgb;
    return `
      radial-gradient(ellipse 85% 65% at 10% 15%, rgba(${r},${g},${b},0.55), transparent 58%),
      radial-gradient(ellipse 70% 55% at 90% 10%, rgba(${Math.min(255, r + 40)},${Math.min(255, g + 20)},${Math.max(0, b - 30)},0.28), transparent 52%),
      radial-gradient(ellipse 55% 45% at 75% 90%, rgba(15,23,42,0.4), transparent 55%),
      linear-gradient(155deg, rgb(${Math.max(0, r - 70)},${Math.max(0, g - 55)},${Math.max(0, b - 40)}) 0%, rgb(${Math.max(0, r - 35)},${Math.max(0, g - 25)},${Math.max(0, b - 15)}) 52%, rgb(${Math.max(0, r - 55)},${Math.max(0, g - 40)},${Math.max(0, b - 25)}) 100%)
    `;
  });

  constructor() {
    this.router.events
      .pipe(
        filter(
          (e): e is NavigationError | NavigationEnd | NavigationCancel =>
            e instanceof NavigationError ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (event instanceof NavigationError) {
          this._routeLoading.set(false);
          this._loadError.set('No se pudo cargar la página. Recarga e inténtalo de nuevo.');
          return;
        }
        if (event instanceof NavigationEnd) {
          this._routeLoading.set(false);
          this._loadError.set(null);
          this._url.set(event.urlAfterRedirects);
          this.loadCount = 0;
          return;
        }
        if (event instanceof NavigationCancel) {
          this._routeLoading.set(false);
        }
      });

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      const e = event as unknown as { constructor: { name: string } };
      if (e?.constructor?.name === 'RouteConfigLoadStart') {
        this.loadCount++;
        this._routeLoading.set(true);
      } else if (e?.constructor?.name === 'RouteConfigLoadEnd') {
        this.loadCount = Math.max(0, this.loadCount - 1);
        if (this.loadCount === 0) this._routeLoading.set(false);
      }
    });
  }

  private isExemptRoute(url: string): boolean {
    const path = url.split('?')[0] ?? url;
    return (
      path.includes('/auth/register') ||
      path.includes('/auth/setup-school') ||
      path.includes('/auth/mfa-enroll') ||
      path.includes('/auth/reset-password') ||
      path.includes('/invitation/')
    );
  }

  /** Boot placeholder uses slug (or empty) as id; real tenants carry a public UUID. */
  private isPlaceholder(t: Tenant): boolean {
    if (!t.id) return true;
    return t.id === t.slug;
  }

  private primaryRgb(): { r: number; g: number; b: number } | null {
    const hex = this.assets.primaryColor();
    if (!hex) return null;
    const normalized = hex.replace('#', '');
    const full =
      normalized.length === 3
        ? normalized
            .split('')
            .map((c) => c + c)
            .join('')
        : normalized;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }
}

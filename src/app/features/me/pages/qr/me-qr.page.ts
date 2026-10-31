import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeQr } from '../../models/me-qr.model';
import { MeProfile } from '../../models/me-profile.model';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-qr',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div class="mb-5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 print:hidden">
        <a routerLink="/me/profile" class="font-semibold text-indigo-600 hover:text-indigo-700">Volver a Mi perfil</a>
        <span aria-hidden="true">/</span>
        <span>Mi espacio</span>
        <span aria-hidden="true">/</span>
        <span class="font-semibold text-slate-800 dark:text-slate-200">Credencial digital</span>
      </div>
      <header class="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Cuaderno de control digital</p>
          <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Mi QR Estudiantil</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Tu código para que el personal del colegio registre tu asistencia. Puedes mostrarlo desde tu celular o imprimirlo.
          </p>
        </div>
        @if (qr()?.svgDataUri) {
          <div class="flex flex-wrap gap-2 print:hidden">
            <button type="button" class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" (click)="printCredential()">
              Imprimir
            </button>
            <button type="button" class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700" (click)="downloadQr()">
              Descargar QR (SVG)
            </button>
          </div>
        }
      </header>

      @if (loading()) {
        <div class="h-96 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"></div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (qr()) {
        @let q = qr()!;
        <article class="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div class="flex flex-col justify-between gap-4 bg-gradient-to-r from-blue-700 to-indigo-900 px-6 py-5 text-white sm:flex-row sm:items-center sm:px-8">
            <div class="flex items-center gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-lg font-bold">
                {{ schoolInitials() }}
              </div>
              <div>
                <p class="font-bold">{{ profile()?.tenantName || 'EduShift' }}</p>
                <p class="text-sm text-blue-100">Carnet oficial del estudiante{{ profile()?.academicYearLabel ? ' · Periodo lectivo ' + profile()?.academicYearLabel : '' }}</p>
              </div>
            </div>
            <span class="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-200">
              <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
              {{ q.hasCredential ? 'Vigente · Activo' : 'Pendiente de emisión' }}
            </span>
          </div>

          <div class="grid gap-8 bg-[radial-gradient(#dbeafe_1px,transparent_1px)] bg-[size:18px_18px] p-5 dark:bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] sm:p-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
            <div>
              <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div class="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 text-3xl font-bold text-white shadow-lg ring-4 ring-white dark:ring-slate-900" aria-hidden="true">
                  {{ studentInitials() }}
                </div>
                <div>
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">Credencial del estudiante</p>
                  <h2 class="mt-1 text-2xl font-bold leading-tight text-slate-950 dark:text-white sm:text-3xl">{{ studentName() }}</h2>
                  <p class="mt-2 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <span class="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                    {{ studentPlacement() }}
                  </p>
                </div>
              </div>

              <div class="mt-7 grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Código de estudiante</p>
                <p class="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">{{ studentCodeLabel() }}</p>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Vigencia</p>
                  <p class="mt-1 font-semibold text-slate-900 dark:text-slate-100">{{ q.hasCredential ? 'Activa' : 'Sin emitir' }}</p>
                </div>
              </div>

              <div class="mt-5 rounded-2xl border border-blue-100 bg-blue-50/90 p-4 dark:border-blue-900 dark:bg-blue-950/60">
                <p class="font-semibold text-blue-950 dark:text-blue-100">
                  @if (q.hasCredential && q.issuedAt) {
                    Credencial generada el {{ q.issuedAt | date: 'dd/MM/yyyy · HH:mm' }}
                  } @else {
                    Aún no tienes una credencial activa.
                  }
                </p>
                <p class="mt-1 text-sm leading-6 text-blue-800 dark:text-blue-200">
                  Mostrar el QR no cambia el código. Si pierdes tu carnet o deja de funcionar, solicita a secretaría que lo renueve.
                </p>
              </div>
            </div>

            <div class="mx-auto w-full max-w-sm rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-md dark:border-slate-700 dark:bg-slate-950">
              <div class="flex min-h-64 items-center justify-center rounded-2xl bg-white p-3">
                @if (q.svgDataUri) {
                  <img [src]="q.svgDataUri" alt="Código QR personal de asistencia" class="h-56 w-56 max-w-full" />
                } @else {
                  <p class="text-center text-sm text-slate-500">Aún no hay un código para mostrar. Emite tu credencial una sola vez.</p>
                }
              </div>
              <div class="mt-4 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
                <p class="font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Código único de acceso</p>
                <p class="mt-1 break-all font-mono text-xs text-slate-500">{{ q.hasCredential ? (q.studentPublicUuid || 'Credencial EduShift') : 'Pendiente de emisión' }}</p>
              </div>
              @if (!q.svgDataUri) {
                <button type="button" class="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 print:hidden" [disabled]="revealing()" (click)="reveal()" aria-label="Mostrar código QR de asistencia">
                  {{ revealing() ? 'Generando credencial…' : 'Generar mi QR' }}
                </button>
              }
            </div>
          </div>

          @if (q.svgDataUri) {
            <div class="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 px-5 py-4 text-sm print:hidden dark:border-slate-800">
              @if (q.studentPublicUuid) {
                <button type="button" class="font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300" (click)="copyStudentCode()" aria-live="polite">{{ copied() ? 'Código copiado' : 'Copiar código de estudiante' }}</button>
                <span class="text-slate-300" aria-hidden="true">•</span>
              }
              <button type="button" class="font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300" (click)="downloadQr()">Guardar imagen QR</button>
            </div>
          }

          <footer class="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <span><span class="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500"></span>Credencial personal del portal EduShift</span>
            <span>Usa este código únicamente en tu institución.</span>
          </footer>
        </article>

        <section class="mt-10" aria-labelledby="qr-usage-title">
          <h2 id="qr-usage-title" class="text-xl font-bold text-slate-950 dark:text-white">¿Dónde y cómo utilizar tu carnet QR?</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">Puedes mostrar el código en tu celular o llevarlo impreso para que el personal autorizado lo escanee.</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700 dark:bg-blue-950 dark:text-blue-300" aria-hidden="true">↪</span>
              <h3 class="mt-3 font-bold text-slate-900 dark:text-slate-100">Asistencia escolar</h3>
              <p class="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">Muestra tu credencial al docente o personal encargado para registrar tu asistencia.</p>
            </article>
            <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" aria-hidden="true">▣</span>
              <h3 class="mt-3 font-bold text-slate-900 dark:text-slate-100">En pantalla o impreso</h3>
              <p class="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">Ajusta el brillo del celular o imprime el QR para tenerlo disponible sin conexión.</p>
            </article>
            <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-700 dark:bg-amber-950 dark:text-amber-300" aria-hidden="true">!</span>
              <h3 class="mt-3 font-bold text-slate-900 dark:text-slate-100">Cuida tu código</h3>
              <p class="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">No compartas capturas del QR. Si pierdes la credencial, comunícate con secretaría.</p>
            </article>
          </div>
        </section>
      }
    </section>
  `,
})
export class MeQrPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly qr = signal<MeQr | null>(null);
  readonly profile = signal<MeProfile | null>(null);
  readonly copied = signal(false);
  readonly loading = signal(true);
  readonly revealing = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.profile.set(response.data ?? null), error: () => this.profile.set(null) });
    this.api
      .getQr()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.qr.set(response.data ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar tu credencial QR.');
          this.loading.set(false);
        },
      });
  }

  reveal(): void {
    this.revealing.set(true);
    this.error.set(null);
    this.api
      .revealQr()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.qr.set(response.data ?? null);
          this.revealing.set(false);
        },
        error: () => {
          this.error.set('No se pudo generar el QR.');
          this.revealing.set(false);
        },
      });
  }

  studentName(): string {
    const profile = this.profile();
    return profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Estudiante';
  }

  studentInitials(): string {
    const profile = this.profile();
    return profile
      ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toLocaleUpperCase('es-PE')
      : 'ES';
  }

  schoolInitials(): string {
    return (this.profile()?.tenantName ?? 'EduShift')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toLocaleUpperCase('es-PE'))
      .join('');
  }

  studentPlacement(): string {
    const profile = this.profile();
    return [profile?.gradeName, profile?.sectionName ? `Sección ${profile.sectionName}` : null]
      .filter(Boolean)
      .join(' · ') || 'Sección no asignada';
  }

  studentCodeLabel(): string {
    const code = this.qr()?.studentPublicUuid;
    return code ? code.slice(0, 8).toLocaleUpperCase('es-PE') : 'Credencial personal';
  }

  printCredential(): void {
    window.print();
  }

  downloadQr(): void {
    const dataUri = this.qr()?.svgDataUri;
    if (!dataUri) return;

    const [metadata, encodedData] = dataUri.split(',', 2);
    if (!metadata || !encodedData) return;
    const svg = metadata.includes(';base64') ? atob(encodedData) : decodeURIComponent(encodedData);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'edushift-credencial-qr.svg';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  copyStudentCode(): void {
    const studentPublicUuid = this.qr()?.studentPublicUuid;
    if (studentPublicUuid && navigator.clipboard) {
      navigator.clipboard.writeText(studentPublicUuid).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      }).catch(() => this.copied.set(false));
    }
  }
}

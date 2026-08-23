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
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-qr',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mi QR</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Este es el código de tu cuaderno de control. Abrirlo o mostrarlo de
          nuevo <strong>no lo cambia</strong>. Si lo perdiste, avisa a secretaría
          para que emitan uno nuevo.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (qr()) {
        @let q = qr()!;
        <div
          class="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <p class="text-sm text-slate-500">
            @if (q.hasCredential && q.issuedAt) {
              Credencial emitida el {{ q.issuedAt | date: 'dd/MM/yyyy HH:mm' }}
            } @else {
              Aún no tienes una credencial activa.
            }
          </p>
          @if (q.svgDataUri) {
            <img
              [src]="q.svgDataUri"
              alt="Código QR personal de asistencia"
              class="mx-auto mt-6 h-56 w-56"
            />
          } @else {
            <p class="mt-6 text-center text-sm text-slate-500">
              Aún no hay un código para mostrar. Pide el primero una sola vez;
              después queda fijo para imprimir.
            </p>
          }
          @if (!q.svgDataUri) {
            <button
              type="button"
              class="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              [disabled]="revealing()"
              (click)="reveal()"
              aria-label="Mostrar código QR de asistencia"
            >
              {{ revealing() ? 'Generando…' : 'Mostrar QR' }}
            </button>
          }
        </div>
      }
    </section>
  `,
})
export class MeQrPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly qr = signal<MeQr | null>(null);
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
}

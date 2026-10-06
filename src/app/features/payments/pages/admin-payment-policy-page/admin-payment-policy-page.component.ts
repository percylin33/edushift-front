import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentsApiService } from '../../services/payments-api.service';
import { AgingBuckets, PaymentPolicy, centsToSoles, formatMoney, solesToCents } from '../../models/invoice.model';

/**
 * Admin — collection policy, aging summary, CSV export, access overrides.
 */
@Component({
  selector: 'app-admin-payment-policy-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            Política de cobros
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Mora, bloqueo LMS suave, recordatorios y reportes de antigüedad.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            (click)="infoOpen.set(!infoOpen())"
            [attr.aria-expanded]="infoOpen()"
            aria-controls="policy-help-panel"
          >
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
              aria-hidden="true"
              >i</span
            >
            {{ infoOpen() ? 'Ocultar ayuda' : 'Cómo funciona' }}
          </button>
          <a routerLink="/payments/admin/invoices" class="text-sm font-semibold text-indigo-600">
            Conciliación
          </a>
        </div>
      </header>

      @if (infoOpen()) {
        <aside
          id="policy-help-panel"
          class="mb-6 space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 text-sm text-slate-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-slate-300"
        >
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              ¿Para qué sirve esta pantalla?
            </h2>
            <p class="mt-1 leading-relaxed">
              Define las reglas automáticas de cobranza del colegio: cuándo avisar al padre, cuándo
              aplicar mora, si se restringe el LMS por deuda, y el monto sugerido de descuento por
              hermanos. También muestra la deuda vencida por antigüedad y permite excepciones
              temporales de acceso.
            </p>
          </div>
          <dl class="space-y-3">
            <div>
              <dt class="font-semibold text-slate-900 dark:text-slate-100">
                Días de recordatorio (CSV)
              </dt>
              <dd class="mt-0.5 leading-relaxed">
                Lista de días <em>antes</em> del vencimiento en que se envía la notificación
                <code class="rounded bg-white/70 px-1 dark:bg-slate-900/60">PAYMENT_REMINDER</code>
                al apoderado. Ejemplo <strong>7,3,1</strong>: aviso a 7 días, a 3 días y al día
                anterior. El job corre cada mañana (~08:30).
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-900 dark:text-slate-100">Mora</dt>
              <dd class="mt-0.5 leading-relaxed">
                Si está habilitada, un proceso diario (~06:00) busca facturas vencidas que ya
                superaron los <strong>días de gracia</strong> y les suma un recargo del
                <strong>% mora</strong> sobre el total (una sola vez por factura). Ejemplo: total
                S/ 200, mora 5% → +S/ 10. Facturas marcadas como exentas no reciben mora.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-900 dark:text-slate-100">Bloqueo LMS suave</dt>
              <dd class="mt-0.5 leading-relaxed">
                No cierra sesión ni bloquea Pagos/familia. Si hay cuota vencida hace más de
                <strong>días vencidos para bloquear</strong>, el estudiante/padre no puede
                entregar tareas, enviar intentos de quiz, mensajes de IA ni descargar ciertos
                reportes. El mensaje guía a regularizar en Pagos.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-900 dark:text-slate-100">
                Descuento por hermanos
              </dt>
              <dd class="mt-0.5 leading-relaxed">
                Solo <strong>sugiere</strong>: con 2+ hijos matriculados aparece la familia en
                Planes para que el staff aplique o rechace. El monto fijo (S/) se descuenta por
                alumno solo si el estado es Aplicado. No se aplica solo al guardar aquí.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-900 dark:text-slate-100">Antigüedad + CSV</dt>
              <dd class="mt-0.5 leading-relaxed">
                Es un reporte de “hace cuántos días está vencida la deuda”. Solo suma facturas en
                estado <strong>OVERDUE</strong> (vencidas), agrupadas por días desde la fecha de
                vencimiento hasta hoy. Ejemplo: pensión de S/ 350 vencida hace 12 días → va al
                bucket 0–30; otra de S/ 350 vencida hace 45 días → 31–60. Los montos se suman
                dentro de cada bucket. <strong>Exportar CSV</strong> baja el detalle factura a
                factura.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-slate-900 dark:text-slate-100">
                Excepción de acceso LMS
              </dt>
              <dd class="mt-0.5 leading-relaxed">
                Permiso temporal para un usuario (UUID) aunque tenga deuda: hasta la fecha indicada
                no aplica el bloqueo suave. Útil en acuerdos de pago o casos especiales. El
                estudiante es opcional (acota la excepción).
              </dd>
            </div>
          </dl>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Los cambios del formulario solo rigen tras pulsar «Guardar política».
          </p>
        </aside>
      }

      @if (banner(); as b) {
        <div
          class="mb-4 rounded-md px-4 py-3 text-sm"
          [class]="b.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
        >
          {{ b.message }}
          <button type="button" class="ml-2 underline" (click)="banner.set(null)">Cerrar</button>
        </div>
      }

      @if (loading()) {
        <div class="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else {
        <form
          class="mb-8 grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:grid-cols-2"
          (ngSubmit)="save()"
        >
          <label class="block text-sm sm:col-span-2">
            <span class="font-medium text-slate-700 dark:text-slate-300">
              Días de recordatorio (CSV, ej. 7,3,1)
            </span>
            <input
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="draft.reminderCsv"
              name="reminderCsv"
            />
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" [(ngModel)]="draft.moraEnabled" name="moraEnabled" />
            <span>Mora habilitada</span>
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Días de gracia</span>
            <input
              type="number"
              min="0"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="draft.moraGraceDays"
              name="moraGraceDays"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">% mora</span>
            <input
              type="number"
              min="0"
              step="0.1"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="draft.moraPercent"
              name="moraPercent"
            />
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" [(ngModel)]="draft.lockEnabled" name="lockEnabled" />
            <span>Bloqueo LMS suave</span>
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">
              Días vencidos para bloquear
            </span>
            <input
              type="number"
              min="0"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="draft.lockOverdueDays"
              name="lockOverdueDays"
            />
          </label>
          <label class="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              [(ngModel)]="draft.siblingDiscountEnabled"
              name="siblingDiscountEnabled"
            />
            <span>Sugerir descuento por hermanos</span>
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">
              Monto fijo por alumno (S/)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="draft.siblingDiscountSoles"
              name="siblingDiscountSoles"
              [disabled]="!draft.siblingDiscountEnabled"
            />
          </label>
          <p class="text-xs text-slate-500 sm:col-span-2">
            El sistema lista familias con 2+ hijos matriculados. Staff decide a quién aplicar el
            descuento; no se aplica solo.
          </p>
          <div class="sm:col-span-2">
            <button
              type="submit"
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              [disabled]="saving()"
            >
              {{ saving() ? 'Guardando…' : 'Guardar política' }}
            </button>
          </div>
        </form>
      }

      <div class="mb-8 rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Antigüedad de la deuda
            </h2>
            <p class="mt-1 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Cuánto dinero está vencido según hace cuántos días pasó la fecha de pago. Solo
              facturas <span class="font-medium">vencidas (OVERDUE)</span>; no incluye pendientes
              que aún no vencen ni las ya pagadas.
            </p>
          </div>
          <button
            type="button"
            class="text-sm font-semibold text-indigo-600 underline"
            (click)="downloadCsv()"
            [disabled]="exporting()"
          >
            {{ exporting() ? 'Exportando…' : 'Exportar CSV' }}
          </button>
        </div>
        @if (aging(); as a) {
          <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt class="text-xs text-slate-500">0–30 días</dt>
              <dd class="mt-1 font-semibold">{{ money(a.d0_30) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">Venció hace poco</p>
            </div>
            <div class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt class="text-xs text-slate-500">31–60 días</dt>
              <dd class="mt-1 font-semibold">{{ money(a.d31_60) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">Retraso medio</p>
            </div>
            <div class="rounded-lg bg-amber-50/80 p-3 dark:bg-amber-950/30">
              <dt class="text-xs text-slate-500">61–90 días</dt>
              <dd class="mt-1 font-semibold">{{ money(a.d61_90) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">Retraso alto</p>
            </div>
            <div class="rounded-lg bg-rose-50/80 p-3 dark:bg-rose-950/30">
              <dt class="text-xs text-slate-500">Más de 90 días</dt>
              <dd class="mt-1 font-semibold">{{ money(a.d90_plus) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">Deuda crítica</p>
            </div>
          </dl>
          <p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Ejemplo: hoy es 17 sep. Una pensión de S/ 400 con vencimiento 5 sep (12 días) suma en
            <strong>0–30</strong>. Otra de S/ 400 con vencimiento 20 jul (59 días) suma en
            <strong>31–60</strong>. Si ambas existen, verías S/ 400 y S/ 400 en esos cuadros (no
            S/ 800 en uno solo).
          </p>
        } @else {
          <p class="text-sm text-slate-500">Sin datos de antigüedad.</p>
        }
      </div>

      <div class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Excepción de acceso LMS
        </h2>
        <form class="grid gap-3 sm:grid-cols-2" (ngSubmit)="createOverride()">
          <label class="block text-sm sm:col-span-2">
            <span class="font-medium text-slate-700 dark:text-slate-300">UUID usuario</span>
            <input
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="override.userPublicUuid"
              name="userPublicUuid"
              required
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">
              UUID estudiante (opc.)
            </span>
            <input
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="override.studentPublicUuid"
              name="studentPublicUuid"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-300">Válido hasta</span>
            <input
              type="datetime-local"
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="override.untilLocal"
              name="untilLocal"
              required
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="font-medium text-slate-700 dark:text-slate-300">Motivo</span>
            <input
              class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              [(ngModel)]="override.reason"
              name="reason"
            />
          </label>
          <div class="sm:col-span-2">
            <button
              type="submit"
              class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
              [disabled]="overriding()"
            >
              {{ overriding() ? 'Guardando…' : 'Crear excepción' }}
            </button>
          </div>
        </form>
      </div>
    </section>
  `,
})
export class AdminPaymentPolicyPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly exporting = signal(false);
  readonly overriding = signal(false);
  readonly infoOpen = signal(false);
  readonly aging = signal<AgingBuckets | null>(null);
  readonly banner = signal<{ ok: boolean; message: string } | null>(null);

  draft = {
    reminderCsv: '7,3,1',
    moraEnabled: false,
    moraGraceDays: 3,
    moraPercent: 5,
    lockEnabled: false,
    lockOverdueDays: 1,
    siblingDiscountEnabled: false,
    siblingDiscountSoles: 0,
  };

  override = {
    userPublicUuid: '',
    studentPublicUuid: '',
    untilLocal: '',
    reason: '',
  };

  ngOnInit(): void {
    this.api.getPolicy().subscribe({
      next: (p: PaymentPolicy) => {
        this.draft = {
          reminderCsv: (p.reminderDaysBeforeDue ?? []).join(','),
          moraEnabled: !!p.moraEnabled,
          moraGraceDays: p.moraGraceDays ?? 3,
          moraPercent: p.moraPercent ?? 5,
          lockEnabled: !!p.lockEnabled,
          lockOverdueDays: p.lockOverdueDays ?? 1,
          siblingDiscountEnabled: !!p.siblingDiscountEnabled,
          siblingDiscountSoles: centsToSoles(p.siblingDiscountCents ?? 0),
        };
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo cargar la política',
        });
      },
    });
    this.api.aging().subscribe({
      next: (a) => this.aging.set(a),
      error: () => this.aging.set(null),
    });
  }

  save(): void {
    const days = this.draft.reminderCsv
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0);
    this.saving.set(true);
    this.api
      .updatePolicy({
        reminderDaysBeforeDue: days,
        moraEnabled: this.draft.moraEnabled,
        moraGraceDays: Number(this.draft.moraGraceDays) || 0,
        moraPercent: Number(this.draft.moraPercent) || 0,
        lockEnabled: this.draft.lockEnabled,
        lockOverdueDays: Number(this.draft.lockOverdueDays) || 0,
        siblingDiscountEnabled: this.draft.siblingDiscountEnabled,
        siblingDiscountCents: solesToCents(Number(this.draft.siblingDiscountSoles) || 0),
        siblingMinCount: 2,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.banner.set({ ok: true, message: 'Política guardada.' });
        },
        error: (e) => {
          this.saving.set(false);
          this.banner.set({
            ok: false,
            message: e?.error?.message ?? 'No se pudo guardar',
          });
        },
      });
  }

  downloadCsv(): void {
    this.exporting.set(true);
    this.api.exportCsv().subscribe({
      next: (text) => {
        this.exporting.set(false);
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'invoices.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => {
        this.exporting.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo exportar CSV',
        });
      },
    });
  }

  createOverride(): void {
    if (!this.override.userPublicUuid.trim() || !this.override.untilLocal) {
      this.banner.set({ ok: false, message: 'Usuario y fecha límite son obligatorios.' });
      return;
    }
    this.overriding.set(true);
    this.api
      .createAccessOverride({
        userPublicUuid: this.override.userPublicUuid.trim(),
        studentPublicUuid: this.override.studentPublicUuid.trim() || null,
        untilAt: new Date(this.override.untilLocal).toISOString(),
        reason: this.override.reason.trim() || null,
      })
      .subscribe({
        next: () => {
          this.overriding.set(false);
          this.banner.set({ ok: true, message: 'Excepción de acceso creada.' });
          this.override.userPublicUuid = '';
          this.override.studentPublicUuid = '';
          this.override.reason = '';
        },
        error: (e) => {
          this.overriding.set(false);
          this.banner.set({
            ok: false,
            message: e?.error?.message ?? 'No se pudo crear la excepción',
          });
        },
      });
  }

  money(cents: number): string {
    return formatMoney(cents ?? 0);
  }
}

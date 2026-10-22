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
import {
  AgingBuckets,
  PaymentAccessCandidate,
  PaymentAccessOverride,
  PaymentPolicy,
  centsToSoles,
  formatMoney,
  solesToCents,
} from '../../models/invoice.model';

/**
 * Admin — collection policy, aging summary, CSV export, access overrides.
 */
@Component({
  selector: 'app-admin-payment-policy-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <nav class="mb-2 text-xs text-slate-500" aria-label="Ruta de navegación">
        Pagos y Tesorería <span class="mx-1">›</span> <span class="text-indigo-600">Políticas de cobranza</span>
      </nav>
      <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="mb-1 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            MÓDULO DE RECAUDACIÓN · POLÍTICA INSTITUCIONAL
          </p>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            Políticas de Cobranza y Control de Acceso
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Mora, acceso al aula virtual, recordatorios preventivos y excepciones temporales.
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
              aplicar mora, si se restringe el acceso al aula virtual por deuda y el descuento sugerido por
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
              <dt class="font-semibold text-slate-900 dark:text-slate-100">Restricción de acceso a clases</dt>
              <dd class="mt-0.5 leading-relaxed">
                No cierra sesión ni bloquea Pagos/familia. Si hay cuota vencida hace más de
                <strong>días vencidos para bloquear</strong>, el estudiante/padre no puede
                entregar tareas, responder cuestionarios, usar el asistente de IA ni descargar ciertos
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
                Excepción de acceso a clases
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

      @if (aging(); as summary) {
        <section class="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de morosidad">
          <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-medium uppercase text-slate-500">Cartera vencida</p>
            <p class="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-300">{{ money(summary.totalOverdueCents) }}</p>
            <p class="mt-1 text-xs text-slate-500">Saldo de facturas OVERDUE</p>
          </article>
          <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-medium uppercase text-slate-500">Alumnos con deuda</p>
            <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{{ summary.totalOverdueStudents }}</p>
            <p class="mt-1 text-xs text-slate-500">En esta institución</p>
          </article>
          <article class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-medium uppercase text-slate-500">Facturas vencidas</p>
            <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{{ summary.totalOverdueInvoices }}</p>
            <p class="mt-1 text-xs text-slate-500">Pendientes de regularización</p>
          </article>
          <article class="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
            <p class="text-xs font-medium uppercase text-rose-700 dark:text-rose-300">Más de 90 días</p>
            <p class="mt-2 text-2xl font-bold text-rose-800 dark:text-rose-200">{{ money(summary.d90_plus.amountCents) }}</p>
            <p class="mt-1 text-xs text-rose-700 dark:text-rose-300">{{ summary.d90_plus.studentCount }} alumnos · {{ summary.d90_plus.invoiceCount }} facturas</p>
          </article>
        </section>
      }

      @if (loading()) {
        <div class="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else {
        <form
          class="mb-5 grid gap-4 rounded-lg bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:grid-cols-2 xl:grid-cols-3"
          (ngSubmit)="save()"
        >
          <div class="sm:col-span-2 xl:col-span-3">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Parámetros de Notificación y Mora</h2>
            <p class="text-xs text-slate-500">Define los avisos preventivos y el recargo diario de cobranza.</p>
          </div>
          <label class="block text-sm sm:col-span-2 xl:col-span-3">
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
            <input
              type="checkbox"
              [(ngModel)]="draft.moraEnabled"
              name="moraEnabled"
              (change)="onMoraToggle()"
              title="Mora habilitada: si está activada, un proceso diario (~06:00) busca facturas vencidas que ya superaron los días de gracia y les suma un recargo del % mora sobre el total (una sola vez por factura). Facturas marcadas como exentas no reciben mora."
            />
            <span>Mora habilitada</span>
          </label>

          @if (draft.moraEnabled) {
            <label class="block text-sm">
              <span class="font-medium text-slate-700 dark:text-slate-300">Días de gracia</span>
              <input
                type="number"
                min="0"
                class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [(ngModel)]="draft.moraGraceDays"
                name="moraGraceDays"
                title="Días de gracia: número de días después del vencimiento en que se empezará a aplicar el recargo de mora. Ejemplo: 3 significa que si una factura está vencida hace 3 días, se le aplicará el recargo."
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
                title="% mora: porcentaje del total de la factura que se adicionará como recargo por mora. Ejemplo: 5 significa S/ 10 de recargo sobre una factura de S/ 200."
              />
            </label>
          }

          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              [(ngModel)]="draft.lockEnabled"
              name="lockEnabled"
              (change)="onLockToggle()"
              title="Restricción de acceso a clases: si está activada, los estudiantes y apoderados con una cuota vencida por más días de los permitidos no podrán entregar tareas, responder cuestionarios, usar el asistente de IA ni descargar ciertos reportes. El mensaje les indicará cómo regularizar el pago."
            />
            <span>Restringir acceso a clases por deuda</span>
          </label>

          @if (draft.lockEnabled) {
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
                title="Días vencidos para bloquear: número de días con cuota vencida después de lo cual se bloquea el acceso del estudiante/padre a funcionalidades académicas."
              />
            </label>
          }

          <label class="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              [(ngModel)]="draft.siblingDiscountEnabled"
              name="siblingDiscountEnabled"
              (change)="onSiblingToggle()"
              title="Sugerir descuento por hermanos: si está activado, el sistema lista familias con 2+ hijos matriculados en Planes para que el staff aplique o rechace el descuento. No se aplica automáticamente al guardar."
            />
            <span>Sugerir descuento por hermanos</span>
          </label>

          @if (draft.siblingDiscountEnabled) {
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
                title="Monto fijo por alumno (S/): cantidad fija en soles que se descuentará por cada alumno con descuento aplicado. Ejemplo: 20 significa S/ 20 por alumno."
              />
            </label>
          }
          <p class="text-xs text-slate-500 sm:col-span-2 xl:col-span-3">
            El sistema lista familias con 2+ hijos matriculados. Staff decide a quién aplicar el
            descuento; no se aplica solo.
          </p>
          <div class="sm:col-span-2 xl:col-span-3">
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

      <div class="mb-5 rounded-lg bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
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
              <dd class="mt-1 font-semibold">{{ money(a.d0_30.amountCents) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">{{ a.d0_30.studentCount }} alumnos · {{ a.d0_30.invoiceCount }} facturas</p>
            </div>
            <div class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt class="text-xs text-slate-500">31–60 días</dt>
              <dd class="mt-1 font-semibold">{{ money(a.d31_60.amountCents) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">{{ a.d31_60.studentCount }} alumnos · {{ a.d31_60.invoiceCount }} facturas</p>
            </div>
            <div class="rounded-lg bg-amber-50/80 p-3 dark:bg-amber-950/30">
              <dt class="text-xs text-slate-500">61–90 días</dt>
              <dd class="mt-1 font-semibold">{{ money(a.d61_90.amountCents) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">{{ a.d61_90.studentCount }} alumnos · {{ a.d61_90.invoiceCount }} facturas</p>
            </div>
            <div class="rounded-lg bg-rose-50/80 p-3 dark:bg-rose-950/30">
              <dt class="text-xs text-slate-500">Más de 90 días</dt>
              <dd class="mt-1 font-semibold">{{ money(a.d90_plus.amountCents) }}</dd>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">{{ a.d90_plus.studentCount }} alumnos · {{ a.d90_plus.invoiceCount }} facturas</p>
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

      <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
        <div class="rounded-lg bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <header class="mb-4">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Excepción de acceso a clases</h2>
            <p class="mt-1 text-xs text-slate-500">Permite acceso temporal pese a deuda vencida. La excepción queda asociada a un alumno y su cuenta.</p>
          </header>
          <form class="grid gap-3" (ngSubmit)="createOverride()">
            <label class="block text-sm">
              <span class="font-medium text-slate-700 dark:text-slate-300">Buscar estudiante o apoderado</span>
              <input
                type="search"
                class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [ngModel]="candidateQuery()"
                (ngModelChange)="searchOverrideCandidates($event)"
                (keydown)="onCandidateKeydown($event)"
                name="candidateQuery"
                placeholder="Alumno, apoderado o documento; mínimo 2 caracteres"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="payment-policy-candidate-listbox"
                [attr.aria-expanded]="!selectedCandidate() && candidates().length > 0"
                [attr.aria-activedescendant]="activeCandidateOptionId()"
              />
            </label>
            @if (candidateLoading()) {
              <p class="text-xs text-slate-500" aria-live="polite">Buscando en el colegio…</p>
            } @else if (candidateQuery().trim().length >= 2 && !selectedCandidate() && candidates().length === 0) {
              <p class="text-xs text-slate-500">No hay cuentas vinculadas para esa búsqueda.</p>
            } @else if (!selectedCandidate() && candidates().length > 0) {
              <ul id="payment-policy-candidate-listbox" role="listbox" class="max-h-48 divide-y overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700" aria-label="Resultados de búsqueda">
                @for (candidate of candidates(); track candidate.userPublicUuid + candidate.studentPublicUuid; let i = $index) {
                  <li>
                    <button type="button" [id]="candidateOptionId(i)" role="option" [attr.aria-selected]="i === activeCandidateIndex()" class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800" [class.bg-slate-50]="i === activeCandidateIndex()" (click)="selectOverrideCandidate(candidate)">
                      <span class="min-w-0">
                        <span class="block truncate font-medium text-slate-900 dark:text-slate-100">{{ candidate.displayName }}</span>
                        <span class="block text-xs text-slate-500">{{ candidate.relationship }}</span>
                      </span>
                      <span class="shrink-0 text-xs text-indigo-600">Seleccionar</span>
                    </button>
                  </li>
                }
              </ul>
            }
            @if (selectedCandidate(); as selected) {
              <div class="flex items-center justify-between gap-3 rounded-md bg-indigo-50 px-3 py-2 text-sm dark:bg-indigo-950/40">
                <span class="min-w-0"><strong class="block truncate text-slate-900 dark:text-slate-100">{{ selected.displayName }}</strong><span class="text-xs text-slate-500">{{ selected.relationship }} · seleccionado</span></span>
                <button type="button" class="text-xs font-semibold text-indigo-700 underline dark:text-indigo-300" (click)="clearOverrideCandidate()">Cambiar</button>
              </div>
            }
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
            <label class="block text-sm">
              <span class="font-medium text-slate-700 dark:text-slate-300">Motivo institucional</span>
              <input
                class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [(ngModel)]="override.reason"
                name="reason"
                maxlength="500"
                placeholder="Acuerdo de pago, revisión de caso…"
              />
            </label>
            <button
              type="submit"
              class="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="overriding() || !selectedCandidate()"
            >
              {{ overriding() ? 'Guardando…' : 'Crear excepción temporal' }}
            </button>
          </form>
        </div>

        <div class="rounded-lg bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <header class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Excepciones vigentes</h2>
              <p class="mt-1 text-xs text-slate-500">Se vencen automáticamente en la fecha indicada.</p>
            </div>
            <span class="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">{{ activeOverrides().length }} activas</span>
          </header>
          @if (overridesLoading()) {
            <div class="space-y-2" aria-busy="true">
              @for (item of [1, 2, 3]; track item) { <div class="h-14 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"></div> }
            </div>
          } @else if (activeOverrides().length === 0) {
            <p class="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No hay excepciones activas.</p>
          } @else {
            <ul class="max-h-[30rem] divide-y overflow-y-auto divide-slate-200 dark:divide-slate-800">
              @for (item of activeOverrides(); track item.publicUuid) {
                <li class="flex items-start justify-between gap-3 py-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{{ item.userName }}</p>
                    @if (item.studentName) { <p class="truncate text-xs text-slate-500">{{ item.studentName }}</p> }
                    <p class="mt-1 text-xs text-slate-500">Hasta {{ item.untilAt | date: 'dd/MM/yyyy, HH:mm' }}</p>
                    @if (item.reason) { <p class="mt-1 line-clamp-2 text-xs text-slate-500">{{ item.reason }}</p> }
                  </div>
                  <button type="button" class="shrink-0 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40" [disabled]="revokingId() === item.publicUuid" (click)="revokeOverride(item)">
                    {{ revokingId() === item.publicUuid ? 'Revocando…' : 'Revocar' }}
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </section>
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
  readonly candidates = signal<PaymentAccessCandidate[]>([]);
  readonly candidateQuery = signal('');
  readonly activeCandidateIndex = signal(0);
  readonly selectedCandidate = signal<PaymentAccessCandidate | null>(null);
  readonly candidateLoading = signal(false);
  readonly activeOverrides = signal<PaymentAccessOverride[]>([]);
  readonly overridesLoading = signal(true);
  readonly revokingId = signal<string | null>(null);

  private candidateSearchTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.loadActiveOverrides();
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
    const selected = this.selectedCandidate();
    if (!selected || !this.override.untilLocal) {
      this.banner.set({ ok: false, message: 'Selecciona una cuenta y una fecha límite.' });
      return;
    }
    this.overriding.set(true);
    this.api
      .createAccessOverride({
        userPublicUuid: selected.userPublicUuid,
        studentPublicUuid: selected.studentPublicUuid,
        untilAt: new Date(this.override.untilLocal).toISOString(),
        reason: this.override.reason.trim() || null,
      })
      .subscribe({
        next: () => {
          this.overriding.set(false);
          this.banner.set({ ok: true, message: 'Excepción de acceso creada.' });
          this.selectedCandidate.set(null);
          this.candidateQuery.set('');
          this.candidates.set([]);
          this.override.untilLocal = '';
          this.override.reason = '';
          this.loadActiveOverrides();
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

  searchOverrideCandidates(query: string): void {
    this.candidateQuery.set(query);
    this.activeCandidateIndex.set(0);
    this.selectedCandidate.set(null);
    this.candidates.set([]);
    if (this.candidateSearchTimer) clearTimeout(this.candidateSearchTimer);
    const search = query.trim();
    if (search.length < 2) {
      this.candidateLoading.set(false);
      return;
    }
    this.candidateSearchTimer = setTimeout(() => {
      this.candidateLoading.set(true);
      this.api.searchAccessOverrideCandidates(search).subscribe({
        next: (results) => {
          this.candidates.set(results);
          this.activeCandidateIndex.set(0);
          this.candidateLoading.set(false);
        },
        error: () => {
          this.candidateLoading.set(false);
          this.banner.set({ ok: false, message: 'No se pudieron buscar estudiantes y apoderados.' });
        },
      });
    }, 250);
  }

  onCandidateKeydown(event: KeyboardEvent): void {
    const candidates = this.candidates();
    if (event.key === 'Escape') {
      if (candidates.length > 0) {
        event.preventDefault();
        this.candidates.set([]);
      }
      return;
    }
    if (candidates.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeCandidateIndex.update((index) => Math.min(index + 1, candidates.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeCandidateIndex.update((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const candidate = candidates[this.activeCandidateIndex()];
      if (candidate) this.selectOverrideCandidate(candidate);
    }
  }

  activeCandidateOptionId(): string | null {
    return this.candidates().length > 0
      ? this.candidateOptionId(this.activeCandidateIndex())
      : null;
  }

  protected candidateOptionId(index: number): string {
    return `payment-policy-candidate-${index}`;
  }

  selectOverrideCandidate(candidate: PaymentAccessCandidate): void {
    this.selectedCandidate.set(candidate);
    this.candidateQuery.set(candidate.displayName);
    this.candidates.set([]);
  }

  clearOverrideCandidate(): void {
    this.selectedCandidate.set(null);
    this.candidateQuery.set('');
    this.candidates.set([]);
  }

  revokeOverride(item: PaymentAccessOverride): void {
    this.revokingId.set(item.publicUuid);
    this.api.revokeAccessOverride(item.publicUuid).subscribe({
      next: () => {
        this.revokingId.set(null);
        this.banner.set({ ok: true, message: `Excepción de ${item.userName} revocada.` });
        this.loadActiveOverrides();
      },
      error: (e) => {
        this.revokingId.set(null);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo revocar la excepción.',
        });
      },
    });
  }

  private loadActiveOverrides(): void {
    this.overridesLoading.set(true);
    this.api.listAccessOverrides().subscribe({
      next: (overrides) => {
        this.activeOverrides.set(overrides);
        this.overridesLoading.set(false);
      },
      error: () => {
        this.activeOverrides.set([]);
        this.overridesLoading.set(false);
      },
    });
  }

  money(cents: number): string {
    return formatMoney(cents ?? 0);
  }

  public onMoraToggle(): void {
    // When mora is disabled, reset grace days and percent to defaults
    if (!this.draft.moraEnabled) {
      this.draft.moraGraceDays = 3;
      this.draft.moraPercent = 5;
    }
  }

  public onLockToggle(): void {
    // When lock is disabled, reset overdue days to default
    if (!this.draft.lockEnabled) {
      this.draft.lockOverdueDays = 1;
    }
  }

  public onSiblingToggle(): void {
    // When sibling discount is disabled, reset the amount
    if (!this.draft.siblingDiscountEnabled) {
      this.draft.siblingDiscountSoles = 0;
    }
  }
}

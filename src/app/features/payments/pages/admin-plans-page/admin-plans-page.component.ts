import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
} from 'rxjs';
import { AcademicApiService } from '@features/academic/services';
import { AcademicLevel, Grade } from '@features/academic/models';
import { StudentsApiService } from '@features/students/services';
import { StudentRow } from '@features/students/models';
import { ConfirmDialogService } from '@shared/components';
import { PaymentsApiService } from '../../services/payments-api.service';
import {
  PaymentConcept,
  PaymentConceptsApiService,
} from '../../services/payment-concepts-api.service';
import {
  BillingPeriod,
  PaymentSubscription,
  SiblingSuggestionGroup,
  centsToSoles,
  formatMoney,
  solesToCents,
} from '../../models/invoice.model';

type AssignMode = 'bulk' | 'single';

/**
 * Admin billing plans — one assign form (bulk by default / single student),
 * sibling-discount review panel, and active plans list.
 */
@Component({
  selector: 'app-admin-plans-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
            Planes de cobro
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Asigna pensiones recurrentes por nivel o grado. Revisa descuentos por hermanos antes
            de cobrar.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            [disabled]="runningDue()"
            (click)="runDue()"
          >
            {{ runningDue() ? 'Ejecutando…' : 'Correr cobros' }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            (click)="toggleAssign()"
          >
            {{ assignOpen() ? 'Cerrar' : 'Asignar planes' }}
          </button>
        </div>
      </header>

      @if (banner(); as b) {
        <div
          class="mb-4 rounded-lg px-4 py-3 text-sm"
          [class]="b.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'"
        >
          {{ b.message }}
          <button type="button" class="ml-2 font-medium underline" (click)="banner.set(null)">
            Cerrar
          </button>
        </div>
      }

      <!-- Single assign panel -->
      @if (assignOpen()) {
        <div
          class="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <div class="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              Asignar planes
            </h2>
            <p class="mt-0.5 text-sm text-slate-500">
              Un solo flujo: elige a quién (grupo o alumno) y el concepto de cobro.
            </p>
            <div
              class="mt-4 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
              role="tablist"
              aria-label="Modo de asignación"
            >
              <button
                type="button"
                role="tab"
                class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
                [class]="
                  assignMode() === 'bulk'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                "
                [attr.aria-selected]="assignMode() === 'bulk'"
                (click)="setAssignMode('bulk')"
              >
                Por nivel o grado
              </button>
              <button
                type="button"
                role="tab"
                class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
                [class]="
                  assignMode() === 'single'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                "
                [attr.aria-selected]="assignMode() === 'single'"
                (click)="setAssignMode('single')"
              >
                Un alumno
              </button>
            </div>
          </div>

          <form class="grid gap-4 p-5 sm:grid-cols-2" (ngSubmit)="submitAssign()">
            <!-- Target: bulk or single -->
            @if (assignMode() === 'bulk') {
              <label class="block text-sm">
                <span class="font-medium text-slate-700 dark:text-slate-300">Alcance</span>
                <select
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  [(ngModel)]="assign.scope"
                  name="assignScope"
                  (ngModelChange)="onScopeChange()"
                >
                  <option value="LEVEL">Todo un nivel (ej. Primaria)</option>
                  <option value="GRADE">Un grado (ej. 3.º Primaria)</option>
                </select>
              </label>
              @if (assign.scope === 'LEVEL') {
                <label class="block text-sm">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Nivel</span>
                  <select
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    [(ngModel)]="assign.levelPublicUuid"
                    name="assignLevel"
                    required
                  >
                    <option value="">— Elegir nivel —</option>
                    @for (lv of levels(); track lv.publicUuid) {
                      <option [value]="lv.publicUuid">{{ lv.code }} · {{ lv.name }}</option>
                    }
                  </select>
                </label>
              } @else {
                <label class="block text-sm">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Grado</span>
                  <select
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    [(ngModel)]="assign.gradePublicUuid"
                    name="assignGrade"
                    required
                  >
                    <option value="">— Elegir grado —</option>
                    @for (g of allGrades(); track g.publicUuid) {
                      <option [value]="g.publicUuid">{{ g.name }}</option>
                    }
                  </select>
                </label>
              }
            } @else {
              <div class="relative block text-sm sm:col-span-2">
                <span class="font-medium text-slate-700 dark:text-slate-300">Estudiante</span>
                @if (selectedStudent(); as st) {
                  <div
                    class="mt-1 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40"
                  >
                    <div>
                      <div class="font-medium text-slate-900 dark:text-slate-100">
                        {{ st.fullName }}
                      </div>
                      <div class="text-xs text-slate-500">
                        {{ st.documentType }} {{ st.documentNumber }}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="text-xs font-semibold text-rose-600"
                      (click)="clearStudent()"
                    >
                      Cambiar
                    </button>
                  </div>
                } @else {
                  <input
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    [ngModel]="studentQuery()"
                    (ngModelChange)="onStudentQuery($event)"
                    name="studentQuery"
                    autocomplete="off"
                    placeholder="Buscar por nombre, apellido o DNI…"
                  />
                  @if (studentSearching()) {
                    <p class="mt-1 text-xs text-slate-500">Buscando…</p>
                  }
                  @if (studentHits().length > 0) {
                    <ul
                      class="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                    >
                      @for (s of studentHits(); track s.publicUuid) {
                        <li>
                          <button
                            type="button"
                            class="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                            (click)="pickStudent(s)"
                          >
                            <span class="font-medium">{{ s.fullName }}</span>
                            <span class="text-xs text-slate-500">
                              {{ s.documentType }} {{ s.documentNumber }}
                            </span>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                }
              </div>
            }

            <!-- Shared billing fields -->
            <label class="block text-sm sm:col-span-2">
              <span class="font-medium text-slate-700 dark:text-slate-300">Concepto</span>
              <select
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [(ngModel)]="assign.conceptPublicUuid"
                name="assignConcept"
                (ngModelChange)="onConceptChange($event)"
                required
              >
                <option value="">— Elegir concepto (pensión, etc.) —</option>
                @for (c of concepts(); track c.publicUuid) {
                  <option [value]="c.publicUuid">
                    {{ c.code }} · {{ c.name }} ({{ money(c.defaultAmountCents, c.currency) }})
                  </option>
                }
              </select>
            </label>
            <label class="block text-sm">
              <span class="font-medium text-slate-700 dark:text-slate-300">Monto (S/)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [(ngModel)]="assign.amountSoles"
                name="assignAmount"
                required
              />
            </label>
            <label class="block text-sm">
              <span class="font-medium text-slate-700 dark:text-slate-300">Periodo</span>
              <select
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                [(ngModel)]="assign.billingPeriod"
                name="assignPeriod"
                (ngModelChange)="onPeriodChange()"
              >
                <option value="MONTHLY">Mensual</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </label>

            @if (assign.billingPeriod === 'ANNUAL') {
              <label class="block text-sm">
                <span class="font-medium text-slate-700 dark:text-slate-300">Mes de cobro</span>
                <select
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  [(ngModel)]="assign.billingMonth"
                  name="assignMonth"
                  required
                >
                  @for (m of months; track m.value) {
                    <option [ngValue]="m.value">{{ m.label }}</option>
                  }
                </select>
              </label>
            }

            <div class="sm:col-span-2">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
                {{ assign.billingPeriod === 'ANNUAL' ? 'Día del mes' : 'Día de cobro cada mes' }}
              </span>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                  [class]="
                    dayPreset() === 'first'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200'
                  "
                  (click)="setDayPreset('first')"
                >
                  Día 1
                </button>
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                  [class]="
                    dayPreset() === 'mid'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200'
                  "
                  (click)="setDayPreset('mid')"
                >
                  Quincena (15)
                </button>
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                  [class]="
                    dayPreset() === 'end'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200'
                  "
                  (click)="setDayPreset('end')"
                >
                  Fin de mes
                </button>
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                  [class]="
                    dayPreset() === 'custom'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200'
                  "
                  (click)="setDayPreset('custom')"
                >
                  Otro día
                </button>
              </div>
              @if (dayPreset() !== 'end') {
                <label class="mt-3 block max-w-[8rem] text-sm">
                  <span class="sr-only">Día</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    [(ngModel)]="assign.billingDayOfMonth"
                    name="assignDay"
                    (ngModelChange)="onCustomDayChange()"
                    required
                  />
                </label>
              } @else {
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Se cobra el último día de cada mes.
                </p>
              }
            </div>

            @if (assignMode() === 'bulk' && bulkPreviewMsg(); as msg) {
              <p
                class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:col-span-2 dark:bg-slate-800/60 dark:text-slate-200"
              >
                {{ msg }}
              </p>
            }

            <div class="flex flex-wrap gap-2 sm:col-span-2">
              @if (assignMode() === 'bulk') {
                <button
                  type="button"
                  class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                  [disabled]="assignBusy()"
                  (click)="bulkPreview()"
                >
                  Vista previa
                </button>
                <button
                  type="submit"
                  class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  [disabled]="assignBusy()"
                >
                  {{ assignBusy() ? 'Asignando…' : 'Confirmar asignación' }}
                </button>
              } @else {
                <button
                  type="submit"
                  class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  [disabled]="assignBusy()"
                >
                  {{ assignBusy() ? 'Creando…' : 'Crear plan' }}
                </button>
              }
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                (click)="assignOpen.set(false)"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Sibling suggestions -->
      <div
        class="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              Descuento por hermanos
              @if (pendingSiblingCount() > 0) {
                <span
                  class="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                >
                  {{ pendingSiblingCount() }} pendientes
                </span>
              }
            </h2>
            <p class="mt-0.5 text-sm text-slate-500">
              Solo se descuenta si aceptas. Configura el monto en
              <a routerLink="/payments/admin/policy" class="font-medium text-indigo-600 underline">
                Política de cobros
              </a>
              .
            </p>
          </div>
          <button
            type="button"
            class="text-sm font-semibold text-indigo-600 hover:underline"
            [disabled]="siblingBusy()"
            (click)="refreshSuggestions()"
          >
            Actualizar
          </button>
        </div>

        @if (siblingGroups().length === 0) {
          <p class="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
            No hay familias sugeridas. Asigna planes y pulsa Actualizar (con la política activa).
          </p>
        } @else {
          <div class="space-y-3">
            @for (g of siblingGroups(); track g.guardianId) {
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold text-slate-900 dark:text-slate-100">
                      {{ g.guardianName || 'Apoderado' }}
                    </div>
                    <div class="text-xs text-slate-500">
                      {{ g.guardianDocument }} · {{ g.siblingCount }} hijos ·
                      {{ money(g.suggestedDiscountCents, 'PEN') }} c/u
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
                      (click)="decideGroup(g, 'APPLIED')"
                    >
                      Aceptar grupo
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600"
                      (click)="decideGroup(g, 'REJECTED')"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
                <ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  @for (c of g.children; track c.subscriptionPublicUuid) {
                    <li class="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <span class="font-medium">{{ c.studentName }}</span>
                        <span class="ml-2 text-xs text-slate-500">
                          {{ c.planCode }} · {{ money(c.amountCents, c.currency) }}
                        </span>
                        <span
                          class="ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                          [class]="siblingBadgeClass(c.siblingDiscountStatus)"
                        >
                          {{ siblingLabel(c.siblingDiscountStatus) }}
                        </span>
                      </div>
                      @if (c.siblingDiscountStatus === 'SUGGESTED' || c.siblingDiscountStatus === 'NONE') {
                        <div class="flex gap-2">
                          <button
                            type="button"
                            class="text-xs font-semibold text-emerald-700"
                            (click)="decideStudents([c.studentPublicUuid], 'APPLIED')"
                          >
                            Aceptar
                          </button>
                          <button
                            type="button"
                            class="text-xs font-semibold text-slate-500"
                            (click)="decideStudents([c.studentPublicUuid], 'REJECTED')"
                          >
                            Rechazar
                          </button>
                        </div>
                      }
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        }
      </div>

      <!-- Plans list -->
      <div>
        <h2 class="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
          Planes activos
        </h2>
        @if (loading()) {
          <div class="space-y-3">
            @for (i of [1, 2, 3]; track i) {
              <div class="h-14 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"></div>
            }
          </div>
        } @else if (items().length === 0) {
          <div
            class="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center dark:border-slate-700"
          >
            <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Aún no hay planes</p>
            <p class="mt-1 text-xs text-slate-500">
              Usa “Asignar planes” para crear pensiones por nivel, grado o alumno.
            </p>
            <button
              type="button"
              class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              (click)="assignOpen.set(true)"
            >
              Asignar planes
            </button>
          </div>
        } @else {
          <div
            class="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-left dark:bg-slate-800/50">
                <tr>
                  <th class="px-4 py-2.5 font-medium text-slate-600">Plan</th>
                  <th class="px-4 py-2.5 font-medium text-slate-600">Estado</th>
                  <th class="px-4 py-2.5 font-medium text-slate-600">Hermanos</th>
                  <th class="px-4 py-2.5 text-right font-medium text-slate-600">Monto</th>
                  <th class="px-4 py-2.5 font-medium text-slate-600">Próximo cobro</th>
                  <th class="px-4 py-2.5 text-right font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (s of items(); track s.publicUuid) {
                  <tr>
                    <td class="px-4 py-3">
                      <div class="font-semibold text-slate-900 dark:text-slate-100">
                        {{ s.planCode }}
                      </div>
                      <div class="text-xs text-slate-500">
                        {{ s.billingPeriod }} · {{ s.studentId | slice: 0:8 }}…
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800"
                      >
                        {{ s.status }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        [class]="siblingBadgeClass(s.siblingDiscountStatus)"
                      >
                        {{ siblingLabel(s.siblingDiscountStatus) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right font-medium">
                      {{ money(s.amountCents, s.currency) }}
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-500">
                      {{ s.nextBillingAt ? (s.nextBillingAt | date: 'dd/MM/yyyy') : '—' }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      @if (s.status === 'ACTIVE') {
                        <button
                          type="button"
                          class="mr-2 text-xs font-semibold text-amber-700"
                          [disabled]="busyUuid() === s.publicUuid"
                          (click)="pause(s)"
                        >
                          Pausar
                        </button>
                      }
                      @if (s.status === 'PAUSED') {
                        <button
                          type="button"
                          class="mr-2 text-xs font-semibold text-emerald-700"
                          [disabled]="busyUuid() === s.publicUuid"
                          (click)="resume(s)"
                        >
                          Reanudar
                        </button>
                      }
                      @if (s.status !== 'CANCELLED') {
                        <button
                          type="button"
                          class="text-xs font-semibold text-rose-700"
                          [disabled]="busyUuid() === s.publicUuid"
                          (click)="cancel(s)"
                        >
                          Cancelar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class AdminPlansPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(PaymentsApiService);
  private readonly studentsApi = inject(StudentsApiService);
  private readonly conceptsApi = inject(PaymentConceptsApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  private readonly studentSearch$ = new Subject<string>();
  private studentSearchSub?: Subscription;

  readonly items = signal<PaymentSubscription[]>([]);
  readonly concepts = signal<PaymentConcept[]>([]);
  readonly levels = signal<AcademicLevel[]>([]);
  readonly siblingGroups = signal<SiblingSuggestionGroup[]>([]);
  readonly loading = signal(true);
  readonly assignBusy = signal(false);
  readonly siblingBusy = signal(false);
  readonly runningDue = signal(false);
  readonly busyUuid = signal<string | null>(null);
  readonly banner = signal<{ ok: boolean; message: string } | null>(null);
  readonly bulkPreviewMsg = signal<string | null>(null);
  readonly assignOpen = signal(false);
  readonly assignMode = signal<AssignMode>('bulk');
  readonly dayPreset = signal<'first' | 'mid' | 'end' | 'custom'>('first');

  readonly months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ] as const;
  readonly studentQuery = signal('');
  readonly studentHits = signal<StudentRow[]>([]);
  readonly studentSearching = signal(false);
  readonly selectedStudent = signal<StudentRow | null>(null);

  readonly allGrades = computed(() => {
    const out: Grade[] = [];
    for (const lv of this.levels()) {
      for (const g of lv.grades ?? []) {
        out.push(g);
      }
    }
    return out;
  });

  readonly pendingSiblingCount = computed(() => {
    let n = 0;
    for (const g of this.siblingGroups()) {
      for (const c of g.children) {
        if (c.siblingDiscountStatus === 'SUGGESTED' || c.siblingDiscountStatus === 'NONE') {
          n++;
        }
      }
    }
    return n;
  });

  assign = {
    conceptPublicUuid: '',
    scope: 'LEVEL' as 'LEVEL' | 'GRADE',
    levelPublicUuid: '',
    gradePublicUuid: '',
    amountSoles: 0,
    billingPeriod: 'MONTHLY' as BillingPeriod,
    billingDayOfMonth: 1,
    billingMonth: 3,
  };

  ngOnInit(): void {
    this.load();
    this.loadConcepts();
    this.loadLevels();
    this.loadSuggestions();
    this.studentSearchSub = this.studentSearch$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 2) {
            this.studentSearching.set(false);
            return of([] as StudentRow[]);
          }
          this.studentSearching.set(true);
          return this.studentsApi.list({ search: term }, { page: 0, size: 15 }).pipe(
            switchMap((page) => of(page.content ?? [])),
            catchError(() => of([] as StudentRow[])),
          );
        }),
      )
      .subscribe((rows) => {
        this.studentSearching.set(false);
        this.studentHits.set(rows);
      });
  }

  ngOnDestroy(): void {
    this.studentSearchSub?.unsubscribe();
  }

  toggleAssign(): void {
    this.assignOpen.update((v) => !v);
  }

  setAssignMode(mode: AssignMode): void {
    this.assignMode.set(mode);
    this.bulkPreviewMsg.set(null);
  }

  onStudentQuery(value: string): void {
    this.studentQuery.set(value);
    this.studentSearch$.next(value);
  }

  pickStudent(s: StudentRow): void {
    this.selectedStudent.set(s);
    this.studentHits.set([]);
    this.studentQuery.set('');
  }

  clearStudent(): void {
    this.selectedStudent.set(null);
    this.studentHits.set([]);
    this.studentQuery.set('');
  }

  onConceptChange(uuid: string): void {
    const c = this.concepts().find((x) => x.publicUuid === uuid);
    if (!c) return;
    this.assign.amountSoles = centsToSoles(c.defaultAmountCents);
  }

  onScopeChange(): void {
    this.assign.levelPublicUuid = '';
    this.assign.gradePublicUuid = '';
    this.bulkPreviewMsg.set(null);
  }

  onPeriodChange(): void {
    if (this.assign.billingPeriod === 'ANNUAL' && !this.assign.billingMonth) {
      this.assign.billingMonth = new Date().getMonth() + 1;
    }
  }

  setDayPreset(preset: 'first' | 'mid' | 'end' | 'custom'): void {
    this.dayPreset.set(preset);
    if (preset === 'first') this.assign.billingDayOfMonth = 1;
    if (preset === 'mid') this.assign.billingDayOfMonth = 15;
    if (preset === 'end') this.assign.billingDayOfMonth = 31;
  }

  onCustomDayChange(): void {
    const d = Number(this.assign.billingDayOfMonth) || 1;
    this.assign.billingDayOfMonth = Math.min(31, Math.max(1, d));
    if (this.assign.billingDayOfMonth === 1) this.dayPreset.set('first');
    else if (this.assign.billingDayOfMonth === 15) this.dayPreset.set('mid');
    else if (this.assign.billingDayOfMonth === 31) this.dayPreset.set('end');
    else this.dayPreset.set('custom');
  }

  private billingPayload() {
    const day = Math.min(31, Math.max(1, Number(this.assign.billingDayOfMonth) || 1));
    return {
      billingDayOfMonth: day,
      billingMonth:
        this.assign.billingPeriod === 'ANNUAL'
          ? Math.min(12, Math.max(1, Number(this.assign.billingMonth) || 1))
          : null,
    };
  }

  load(): void {
    this.loading.set(true);
    this.api.listSubscriptions(undefined, 0, 100).subscribe({
      next: (page) => {
        this.items.set(page.content ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudieron cargar los planes',
        });
      },
    });
  }

  loadConcepts(): void {
    this.conceptsApi.listConcepts(0, 100).subscribe({
      next: ({ items }) => this.concepts.set([...items]),
      error: () => this.concepts.set([]),
    });
  }

  loadLevels(): void {
    this.academicApi.listLevels().subscribe({
      next: (rows) => this.levels.set(rows ?? []),
      error: () => this.levels.set([]),
    });
  }

  loadSuggestions(): void {
    this.api.listSiblingSuggestions().subscribe({
      next: (groups) => this.siblingGroups.set(groups ?? []),
      error: () => this.siblingGroups.set([]),
    });
  }

  submitAssign(): void {
    if (this.assignMode() === 'bulk') {
      this.bulkConfirm();
    } else {
      this.createSingle();
    }
  }

  createSingle(): void {
    const student = this.selectedStudent();
    if (!student || !this.assign.conceptPublicUuid) {
      this.banner.set({ ok: false, message: 'Elige un estudiante y un concepto.' });
      return;
    }
    this.assignBusy.set(true);
    this.api
      .createSubscription({
        studentPublicUuid: student.publicUuid,
        conceptPublicUuid: this.assign.conceptPublicUuid,
        planCode: null,
        amountCents: solesToCents(Number(this.assign.amountSoles) || 0),
        billingPeriod: this.assign.billingPeriod,
        ...this.billingPayload(),
        currency: 'PEN',
      })
      .subscribe({
        next: () => {
          this.assignBusy.set(false);
          this.banner.set({ ok: true, message: `Plan creado para ${student.fullName}.` });
          this.clearStudent();
          this.resetAssignFields();
          this.assignOpen.set(false);
          this.load();
          this.loadSuggestions();
        },
        error: (e) => {
          this.assignBusy.set(false);
          this.banner.set({
            ok: false,
            message: e?.error?.message ?? 'No se pudo crear el plan',
          });
        },
      });
  }

  private bulkBody(dryRun: boolean) {
    return {
      conceptPublicUuid: this.assign.conceptPublicUuid,
      levelPublicUuid: this.assign.scope === 'LEVEL' ? this.assign.levelPublicUuid || null : null,
      gradePublicUuid: this.assign.scope === 'GRADE' ? this.assign.gradePublicUuid || null : null,
      amountCents: solesToCents(Number(this.assign.amountSoles) || 0),
      billingPeriod: this.assign.billingPeriod,
      ...this.billingPayload(),
      currency: 'PEN',
      dryRun,
    };
  }

  bulkPreview(): void {
    if (!this.assign.conceptPublicUuid) {
      this.banner.set({ ok: false, message: 'Elige un concepto.' });
      return;
    }
    if (this.assign.scope === 'LEVEL' && !this.assign.levelPublicUuid) {
      this.banner.set({ ok: false, message: 'Elige un nivel.' });
      return;
    }
    if (this.assign.scope === 'GRADE' && !this.assign.gradePublicUuid) {
      this.banner.set({ ok: false, message: 'Elige un grado.' });
      return;
    }
    this.assignBusy.set(true);
    this.api.bulkCreateSubscriptions(this.bulkBody(true)).subscribe({
      next: (r) => {
        this.assignBusy.set(false);
        const wouldCreate =
          r.candidateCount - r.skippedAlreadyActive - r.skippedNoGuardian;
        this.bulkPreviewMsg.set(
          `${r.candidateCount} alumnos en el alcance → se crearían ${wouldCreate} planes (${r.skippedAlreadyActive} ya activos, ${r.skippedNoGuardian} sin apoderado portal).`,
        );
      },
      error: (e) => {
        this.assignBusy.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo previsualizar',
        });
      },
    });
  }

  bulkConfirm(): void {
    if (!this.assign.conceptPublicUuid) {
      this.banner.set({ ok: false, message: 'Elige un concepto.' });
      return;
    }
    if (this.assign.scope === 'LEVEL' && !this.assign.levelPublicUuid) {
      this.banner.set({ ok: false, message: 'Elige un nivel.' });
      return;
    }
    if (this.assign.scope === 'GRADE' && !this.assign.gradePublicUuid) {
      this.banner.set({ ok: false, message: 'Elige un grado.' });
      return;
    }
    this.assignBusy.set(true);
    this.api.bulkCreateSubscriptions(this.bulkBody(false)).subscribe({
      next: (r) => {
        this.assignBusy.set(false);
        this.bulkPreviewMsg.set(null);
        this.banner.set({
          ok: true,
          message: `Creados ${r.createdCount} planes. Ya activos: ${r.skippedAlreadyActive}. Sin apoderado: ${r.skippedNoGuardian}.`,
        });
        this.resetAssignFields();
        this.assignOpen.set(false);
        this.load();
        this.loadSuggestions();
      },
      error: (e) => {
        this.assignBusy.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo asignar en masa',
        });
      },
    });
  }

  private resetAssignFields(): void {
    this.assign.conceptPublicUuid = '';
    this.assign.levelPublicUuid = '';
    this.assign.gradePublicUuid = '';
    this.assign.amountSoles = 0;
    this.assign.billingDayOfMonth = 1;
    this.dayPreset.set('first');
  }

  refreshSuggestions(): void {
    this.siblingBusy.set(true);
    this.api.refreshSiblingSuggestions().subscribe({
      next: (r) => {
        this.siblingBusy.set(false);
        this.banner.set({
          ok: true,
          message: `Sugerencias actualizadas (${r.markedSuggested} marcadas).`,
        });
        this.loadSuggestions();
        this.load();
      },
      error: (e) => {
        this.siblingBusy.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudieron actualizar sugerencias',
        });
      },
    });
  }

  decideGroup(g: SiblingSuggestionGroup, decision: 'APPLIED' | 'REJECTED'): void {
    const uuids = [...new Set(g.children.map((c) => c.studentPublicUuid))];
    this.decideStudents(uuids, decision);
  }

  decideStudents(studentPublicUuids: string[], decision: 'APPLIED' | 'REJECTED'): void {
    this.siblingBusy.set(true);
    this.api.decideSiblingDiscount(studentPublicUuids, decision).subscribe({
      next: (r) => {
        this.siblingBusy.set(false);
        this.banner.set({
          ok: true,
          message:
            decision === 'APPLIED'
              ? `Descuento aplicado a ${r.updated} plan(es).`
              : `Descuento rechazado en ${r.updated} plan(es).`,
        });
        this.loadSuggestions();
        this.load();
      },
      error: (e) => {
        this.siblingBusy.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo registrar la decisión',
        });
      },
    });
  }

  pause(s: PaymentSubscription): void {
    this.act(s.publicUuid, () => this.api.pauseSubscription(s.publicUuid), 'Plan pausado.');
  }

  resume(s: PaymentSubscription): void {
    this.act(s.publicUuid, () => this.api.resumeSubscription(s.publicUuid), 'Plan reanudado.');
  }

  async cancel(s: PaymentSubscription): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Cancelar plan',
      message: `¿Cancelar el plan ${s.planCode}?`,
      confirmLabel: 'Cancelar plan',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    this.act(s.publicUuid, () => this.api.cancelSubscription(s.publicUuid), 'Plan cancelado.');
  }

  runDue(): void {
    this.runningDue.set(true);
    this.api.runDue().subscribe({
      next: (r) => {
        this.runningDue.set(false);
        this.banner.set({ ok: true, message: `Se emitieron ${r.issued} cuotas.` });
        this.load();
      },
      error: (e) => {
        this.runningDue.set(false);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'No se pudo correr cobros',
        });
      },
    });
  }

  money(cents: number, c: string): string {
    return formatMoney(cents, c);
  }

  siblingLabel(status: string | null | undefined): string {
    switch (status) {
      case 'SUGGESTED':
        return 'Sugerido';
      case 'APPLIED':
        return 'Aplicado';
      case 'REJECTED':
        return 'Rechazado';
      default:
        return '—';
    }
  }

  siblingBadgeClass(status: string | null | undefined): string {
    switch (status) {
      case 'SUGGESTED':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
      case 'APPLIED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
      case 'REJECTED':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-slate-50 text-slate-400';
    }
  }

  private act(
    uuid: string,
    call: () => ReturnType<PaymentsApiService['pauseSubscription']>,
    okMsg: string,
  ): void {
    this.busyUuid.set(uuid);
    call().subscribe({
      next: () => {
        this.busyUuid.set(null);
        this.banner.set({ ok: true, message: okMsg });
        this.load();
      },
      error: (e) => {
        this.busyUuid.set(null);
        this.banner.set({
          ok: false,
          message: e?.error?.message ?? 'Operación fallida',
        });
      },
    });
  }
}

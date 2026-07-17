import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { AiUsageService, UsageSummary } from '../../services/ai-usage.service';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { firstValueFrom } from 'rxjs';

/**
 * AI usage dashboard (FE-8.4).
 *
 * <p>TENANT_ADMIN view: quota meter, per-feature breakdown, daily
 * history table, and CSV export. The page lives at
 * {@code /ai/usage} and is gated by {@code LMS_AI_USAGE} (see
 * {@code docs/product/roles-matrix.md}).</p>
 */
@Component({
  selector: 'app-ai-usage-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, IconComponent, SpinnerComponent],
  template: `
    <div class="mx-auto max-w-6xl space-y-6 p-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Uso de IA</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400">Periodo: {{ periodLabel() }}</p>
        </div>
        <a
          [href]="csvUrl()"
          download
          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <app-icon name="download" class="h-4 w-4"></app-icon>
          Exportar CSV
        </a>
      </header>

      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <app-spinner class="h-4 w-4"></app-spinner> Cargando…
        </div>
      }

      @if (!loading() && error()) {
        @let e = error();
        <p class="text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
      }

      @if (summary(); as s) {
        <!-- Quota meter -->
        <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Requests este mes
            </p>
            <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {{ s.usedRequests }}
              @if (s.dailyRequestQuota) {
                <span class="ml-1 text-sm font-normal text-slate-500"
                  >/ {{ s.dailyRequestQuota }} (diario)</span
                >
              }
            </p>
            @if (s.dailyRequestQuota) {
              <div
                class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
              >
                <div
                  [style.width.%]="quotaPercent(s.usedRequests, s.dailyRequestQuota)"
                  [class.bg-rose-500]="quotaPercent(s.usedRequests, s.dailyRequestQuota) > 80"
                  [class.bg-amber-500]="
                    quotaPercent(s.usedRequests, s.dailyRequestQuota) > 50 &&
                    quotaPercent(s.usedRequests, s.dailyRequestQuota) <= 80
                  "
                  [class.bg-emerald-500]="quotaPercent(s.usedRequests, s.dailyRequestQuota) <= 50"
                  class="h-full"
                ></div>
              </div>
            }
          </div>

          <div
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tokens este mes
            </p>
            <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {{ s.usedTokens }}
              @if (s.monthlyTokenQuota) {
                <span class="ml-1 text-sm font-normal text-slate-500"
                  >/ {{ s.monthlyTokenQuota }}</span
                >
              }
            </p>
            @if (s.monthlyTokenQuota) {
              <div
                class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
              >
                <div
                  [style.width.%]="quotaPercent(s.usedTokens, s.monthlyTokenQuota)"
                  [class.bg-rose-500]="quotaPercent(s.usedTokens, s.monthlyTokenQuota) > 80"
                  [class.bg-amber-500]="
                    quotaPercent(s.usedTokens, s.monthlyTokenQuota) > 50 &&
                    quotaPercent(s.usedTokens, s.monthlyTokenQuota) <= 80
                  "
                  [class.bg-emerald-500]="quotaPercent(s.usedTokens, s.monthlyTokenQuota) <= 50"
                  class="h-full"
                ></div>
              </div>
            }
          </div>

          <div
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tasa de exito
            </p>
            <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {{ successRate(s) }}%
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {{ s.successCount }} OK · {{ s.failedCount }} fallidos
            </p>
          </div>
        </section>

        <!-- By feature -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <h2 class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Por feature</h2>
          @if (s.byFeature.length) {
            <ul class="space-y-2">
              @for (f of s.byFeature; track f.feature) {
                <li>
                  <div class="mb-1 flex items-center justify-between text-xs">
                    <span class="font-medium text-slate-700 dark:text-slate-200">{{
                      f.feature
                    }}</span>
                    <span class="text-slate-500"
                      >{{ f.requestCount }} requests · {{ f.tokensIn + f.tokensOut }} tokens</span
                    >
                  </div>
                  <div
                    class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                  >
                    <div
                      [style.width.%]="featurePercent(f.requestCount, s.usedRequests)"
                      class="h-full bg-indigo-500"
                    ></div>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-slate-500">Sin uso registrado este mes.</p>
          }
        </section>

        <!-- Daily history -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <h2 class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Historico diario
          </h2>
          @if (s.daily.length) {
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead>
                  <tr class="text-left text-slate-500 dark:text-slate-400">
                    <th class="px-2 py-1">Dia</th>
                    <th class="px-2 py-1">Requests</th>
                    <th class="px-2 py-1">OK</th>
                    <th class="px-2 py-1">Fallos</th>
                    <th class="px-2 py-1">Tokens in</th>
                    <th class="px-2 py-1">Tokens out</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of s.daily; track d.day) {
                    <tr class="border-t border-slate-200 dark:border-slate-700">
                      <td class="px-2 py-1 text-slate-800 dark:text-slate-200">{{ d.day }}</td>
                      <td class="px-2 py-1">{{ d.requestCount }}</td>
                      <td class="px-2 py-1 text-emerald-600 dark:text-emerald-400">
                        {{ d.successCount }}
                      </td>
                      <td class="px-2 py-1 text-rose-600 dark:text-rose-400">
                        {{ d.failedCount }}
                      </td>
                      <td class="px-2 py-1">{{ d.tokensIn }}</td>
                      <td class="px-2 py-1">{{ d.tokensOut }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="text-sm text-slate-500">Sin historial este mes.</p>
          }
        </section>
      }
    </div>
  `,
})
export class AiUsagePageComponent implements OnInit {
  private readonly service = inject(AiUsageService);

  readonly summary = signal<UsageSummary | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly csvUrl = signal<string>(this.service.csvDownloadUrl());

  readonly periodLabel = computed(() => {
    const s = this.summary();
    if (!s) return '';
    return `${s.periodStart} → ${s.periodEnd}`;
  });

  async ngOnInit(): Promise<void> {
    try {
      const s = await firstValueFrom(this.service.summary());
      this.summary.set(s);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo cargar el uso de IA.');
    } finally {
      this.loading.set(false);
    }
  }

  quotaPercent(used: number, quota: number | null | undefined): number {
    if (!quota || quota <= 0) return 0;
    return Math.min(100, Math.round((used / quota) * 100));
  }

  featurePercent(v: number, total: number): number {
    if (!total) return 0;
    return Math.min(100, Math.round((v / total) * 100));
  }

  successRate(s: UsageSummary): number {
    if (!s.usedRequests) return 0;
    return Math.round((s.successCount / s.usedRequests) * 100);
  }
}

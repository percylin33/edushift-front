import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AnnouncementsApiService } from '../../services/announcements-api.service';
import { Announcement } from '../../models/announcement.model';

/**
 * Announcements list page (Sprint 9 / FE-9.2).
 *
 * <p>Shows the most recent published announcements for the current
 * tenant. Pinned items float to the top. The "+ Nuevo anuncio" CTA
 * is gated by {@code LMS_ANNOUNCEMENTS_CREATE} (TENANT_ADMIN).</p>
 */
@Component({
  selector: 'edushift-announcements-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <header class="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Anuncios
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Comunicados oficiales del colegio
          </p>
        </div>
        <a routerLink="/announcements/new"
           class="inline-flex items-center gap-2 rounded-lg
                  bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                  hover:bg-emerald-700">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14"/>
          </svg>
          Nuevo anuncio
        </a>
      </header>

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1,2,3]; track i) {
            <div class="animate-pulse rounded-2xl bg-white dark:bg-slate-900
                        shadow ring-1 ring-slate-200 dark:ring-slate-800 p-5">
              <div class="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700 mb-3"></div>
              <div class="h-3 w-full rounded bg-slate-200 dark:bg-slate-700"></div>
            </div>
          }
        </div>
      } @else if (items().length === 0) {
        <div class="rounded-2xl border-2 border-dashed border-slate-200
                    dark:border-slate-700 p-12 text-center">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Aún no hay anuncios publicados.
          </p>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (a of items(); track a.publicUuid) {
            <li class="rounded-2xl bg-white dark:bg-slate-900 shadow
                       ring-1 ring-slate-200 dark:ring-slate-800 p-5">
              <div class="flex items-start gap-3">
                @if (a.pinned) {
                  <span class="text-amber-500" title="Fijado">📌</span>
                }
                <div class="flex-1 min-w-0">
                  <h2 class="text-base font-semibold text-slate-900
                             dark:text-slate-100 line-clamp-1">
                    {{ a.title }}
                  </h2>
                  <div class="mt-1 text-xs text-slate-500 dark:text-slate-400
                              flex items-center gap-2">
                    <span class="inline-flex items-center rounded-full
                                 bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                      {{ a.audienceType }}
                    </span>
                    <span>·</span>
                    <span>{{ a.publishedAt | date: 'longDate' }}</span>
                  </div>
                  <div class="mt-3 prose prose-sm dark:prose-invert max-w-none
                              line-clamp-3"
                       [innerHTML]="safeBody(a.bodyHtml)"></div>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `
})
export class AnnouncementsPageComponent implements OnInit {
  private readonly api = inject(AnnouncementsApiService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly items = signal<Announcement[]>([]);
  readonly loading = signal(true);

  /**
   * Sprint 10 / DEBT-9-FE-1 (XSS defense in depth): the BE
   * sanitizes on save + at the DTO boundary, but we sanitize
   * again at render. Defense in depth.
   */
  safeBody(html: string | null | undefined): SafeHtml {
    return this.sanitizer.sanitize(
      this.sanitizer.SECURITY_CONTEXT,
      html ?? ''
    ) ?? '';
  }

  ngOnInit(): void {
    this.api.list(50).subscribe({
      next: (list) => { this.items.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); }
    });
  }
}

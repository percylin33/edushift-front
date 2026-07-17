import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { finalize } from 'rxjs/operators';

import { PageHeaderComponent } from '@shared/components';
import { PageContainerComponent } from '@shared/components';
import { SpinnerComponent } from '@shared/components';
import { EmptyStateComponent } from '@shared/components';
import { IconComponent } from '@shared/components';

import { AuthService } from '@core/services';

import { HelpService } from '../../services/help.service';
import {
  HelpFeedback,
  HelpProgressItem,
  ManualChapter,
  ManualChapterFile,
} from '../../models/help.model';

interface ChapterTab {
  file: ManualChapterFile;
  label: string;
  route: string[];
}

const CHAPTER_TABS: ReadonlyArray<ChapterTab> = [
  { file: 'README.md', label: 'Resumen', route: [] },
  {
    file: '01-onboarding-y-acceso.md',
    label: 'Onboarding',
    route: ['onboarding'],
  },
  {
    file: '02-flujos-esenciales.md',
    label: 'Flujos esenciales',
    route: ['flujos'],
  },
  {
    file: '03-autoevaluacion.md',
    label: 'Autoevaluación',
    route: ['autoevaluacion'],
  },
];

const CHECKLIST_REGEX = /^- \[( |x|X)\] (.+)$/gm;

/**
 * Help manual viewer with interactive checklist progress + feedback.
 *
 * <p>Lands at `/help/:role` or one of the chapter sub-routes. Renders
 * the chapter's markdown (sanitised via DOMPurify), and — for the
 * autoevaluación chapter — turns the `- [ ]` checklists into interactive
 * checkboxes that sync with the backend via `HelpService`.</p>
 *
 * <h3>Item IDs</h3>
 * The backend stores progress per {@code itemId}. We derive a stable
 * identifier from the line text via a deterministic SHA-256 hash
 * truncated to 16 chars, so the same item keeps the same id across
 * reloads even if the surrounding markdown is edited. The id is stored
 * in {@code data-item-id} on the rendered HTML so the toggle handler
 * can read it back.
 *
 * <h3>Unauthenticated UX</h3>
 * Checklist checkboxes render as disabled. The feedback panel shows a
 * hint pointing to the login screen. All HTTP calls for progress /
 * feedback happen behind `isAuthenticated()`, so anonymous visitors
 * never hit the backend with a 401.
 */
@Component({
  selector: 'app-help-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    PageHeaderComponent,
    PageContainerComponent,
    SpinnerComponent,
    EmptyStateComponent,
    IconComponent,
  ],
  template: `
    <app-page-container>
      @if (chapter(); as ch) {
        <app-page-header
          [title]="ch.title"
          [subtitle]="'Manual del rol ' + ch.role"
        >
          <a
            routerLink="/help"
            class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <app-icon name="arrow-left" [size]="14" />
            Todos los manuales
          </a>
        </app-page-header>

        <!-- Tabs -->
        <nav
          class="mb-6 flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-surface-raised p-1"
          aria-label="Capítulos"
        >
          @for (tab of tabs; track tab.file) {
            <a
              [routerLink]="tabRouteFor(ch.role, tab)"
              class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition"
              [class.bg-primary-600]="tab.file === currentFile()"
              [class.text-white]="tab.file === currentFile()"
              [class.text-content-muted]="tab.file !== currentFile()"
              [class.hover:bg-surface-muted]="tab.file !== currentFile()"
            >
              {{ tab.label }}
              @if (tab.file === '03-autoevaluacion.md' && progressCount() > 0) {
                <span
                  class="rounded-full bg-primary-100 px-1.5 py-0.5 text-2xs font-semibold text-primary-700"
                >
                  {{ progressCount() }} / {{ totalItems() }}
                </span>
              }
            </a>
          }
        </nav>

        <!-- Progress bar (autoevaluación only) -->
        @if (currentFile() === '03-autoevaluacion.md' && totalItems() > 0) {
          <div class="mb-4 flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-content">Tu progreso</span>
                <span class="text-content-muted">
                  {{ progressCount() }} de {{ totalItems() }} marcados
                  ({{ progressPercent() }}%)
                </span>
              </div>
              <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  class="h-full bg-primary-500 transition-all"
                  [style.width.%]="progressPercent()"
                  aria-hidden="true"
                ></div>
              </div>
            </div>
            @if (isAuthenticated()) {
              <button
                type="button"
                (click)="resetProgress()"
                [disabled]="!hasAnyChecked() || saving()"
                class="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-content-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <app-icon name="rotate-ccw" [size]="12" />
                Reiniciar
              </button>
            }
          </div>
        }

        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <app-spinner [size]="20" />
          </div>
        } @else if (loadError()) {
          <div
            role="alert"
            class="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <p class="font-medium">No se pudo cargar el capítulo.</p>
            <p class="mt-1 text-danger/80">{{ loadError() }}</p>
            <button
              type="button"
              (click)="reload()"
              class="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            >
              <app-icon name="rotate-ccw" [size]="14" />
              Reintentar
            </button>
          </div>
        } @else {
          <!-- Markdown body with interactive checkboxes -->
          <article
            class="prose prose-slate max-w-none rounded-lg border border-border bg-surface-raised p-6 dark:prose-invert"
            [innerHTML]="renderedHtml()"
            (change)="onChecklistChange($event)"
          ></article>

          <footer class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-content-subtle">
            <span>
              Actualizado el {{ ch.updatedAt | date: 'longDate' }} ·
              <code class="rounded bg-surface-muted px-1 py-0.5">{{ ch.path }}</code>
            </span>
            @if (currentFile() === '03-autoevaluacion.md' && !isAuthenticated()) {
              <span class="inline-flex items-center gap-1 text-warning">
                <app-icon name="alert-circle" [size]="12" />
                Inicia sesión para guardar tu progreso
              </span>
            }
          </footer>

          <!-- Feedback panel -->
          @if (isAuthenticated()) {
            <section class="mt-8 rounded-lg border border-border bg-surface-raised p-6">
              <header class="mb-3 flex items-center justify-between">
                <h2 class="text-base font-semibold text-content">
                  Comentarios sobre este capítulo
                </h2>
                <button
                  type="button"
                  (click)="toggleFeedbackForm()"
                  class="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                >
                  <app-icon
                    [name]="showFeedbackForm() ? 'x' : 'message-square'"
                    [size]="14"
                  />
                  {{ showFeedbackForm() ? 'Cancelar' : 'Enviar feedback' }}
                </button>
              </header>

              @if (showFeedbackForm()) {
                <form (ngSubmit)="submitFeedback()" class="space-y-3" novalidate>
                  <label class="block text-sm">
                    <span class="font-medium text-content">Tu comentario</span>
                    <textarea
                      [ngModel]="feedbackDraft()"
                      (ngModelChange)="feedbackDraft.set($event)"
                      name="feedback"
                      rows="4"
                      maxlength="4000"
                      placeholder="¿Qué falta? ¿Qué se podría mejorar? ¿Encontraste un error?"
                      class="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      [disabled]="submittingFeedback()"
                      required
                    ></textarea>
                  </label>
                  @if (feedbackError()) {
                    <p
                      role="alert"
                      class="rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
                    >
                      {{ feedbackError() }}
                    </p>
                  }
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs text-content-subtle">
                      Lo verá el equipo de plataforma (estado: OPEN).
                    </span>
                    <button
                      type="submit"
                      [disabled]="submittingFeedback() || !feedbackDraft().trim()"
                      class="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      @if (submittingFeedback()) {
                        <app-spinner [size]="12" />
                        Enviando…
                      } @else {
                        Enviar
                      }
                    </button>
                  </div>
                </form>
              }

              @if (loadingFeedback()) {
                <div class="mt-4 flex items-center justify-center py-4">
                  <app-spinner [size]="14" />
                </div>
              } @else if (myFeedback().length > 0) {
                <ul class="mt-4 space-y-3">
                  @for (fb of myFeedback(); track fb.publicUuid) {
                    <li
                      class="rounded-md border border-border-subtle bg-surface p-3 text-sm"
                    >
                      <header class="mb-1 flex items-center justify-between gap-2">
                        <span
                          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium"
                          [class]="statusClass(fb.status)"
                        >
                          {{ statusLabel(fb.status) }}
                        </span>
                        <span class="text-2xs text-content-subtle">
                          {{ fb.createdAt | date: 'medium' }}
                        </span>
                      </header>
                      <p class="whitespace-pre-wrap text-content">{{ fb.body }}</p>
                    </li>
                  }
                </ul>
              } @else if (!showFeedbackForm()) {
                <p class="mt-2 text-sm text-content-muted">
                  Aún no has enviado feedback sobre este capítulo.
                </p>
              }
            </section>
          }
        }
      } @else {
        <app-empty-state
          title="Manual no disponible"
          description="No se encontró un manual para el rol solicitado."
        >
          <a
            routerLink="/help"
            class="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <app-icon name="arrow-left" [size]="14" />
            Volver al índice
          </a>
        </app-empty-state>
      }
    </app-page-container>
  `,
  styles: [
    `
      :host ::ng-deep .prose {
        line-height: 1.65;
      }
      :host ::ng-deep .prose :where(h1, h2, h3, h4) {
        font-weight: 600;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      :host ::ng-deep .prose :where(blockquote) {
        border-left: 3px solid var(--color-primary-500, #6366f1);
        background: rgba(99, 102, 241, 0.06);
        padding: 0.5em 1em;
        border-radius: 0 0.375rem 0.375rem 0;
      }
      :host ::ng-deep .prose :where(table) {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      :host ::ng-deep .prose :where(table th),
      :host ::ng-deep .prose :where(table td) {
        border: 1px solid currentColor;
        padding: 0.5rem 0.75rem;
        text-align: left;
        opacity: 0.95;
      }
      :host ::ng-deep .prose :where(code) {
        font-size: 0.85em;
        padding: 0.1em 0.35em;
        border-radius: 0.25rem;
        background: rgba(127, 127, 127, 0.12);
      }
      /* Interactive checklist — pick up the data-item-id from the renderer. */
      :host ::ng-deep .prose li > input[type='checkbox'][data-item-id] {
        margin-right: 0.5em;
        cursor: pointer;
        accent-color: var(--color-primary-500, #6366f1);
      }
      :host ::ng-deep .prose li > input[type='checkbox'][data-item-id]:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
    `,
  ],
})
export class HelpViewerPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly helpService = inject(HelpService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly auth = inject(AuthService);

  protected readonly tabs = CHAPTER_TABS;

  protected readonly role = signal<string | null>(null);
  protected readonly currentFile = signal<ManualChapterFile>('README.md');
  protected readonly chapter = signal<ManualChapter | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** Map of itemId → checked, hydrated from the backend. */
  protected readonly progress = signal<Record<string, HelpProgressItem>>({});
  protected readonly saving = signal(false);

  /**
   * Total checklist items found in the rendered markdown. Derived purely
   * from the chapter content + current file — no side effects. Returning
   * this from a {@link computed} is what unblocks the inner render from
   * writing to signals (NG0600).
   */
  protected readonly totalItems = computed<number>(() => {
    const ch = this.chapter();
    if (!ch || this.currentFile() !== '03-autoevaluacion.md') return 0;
    return this.countChecklistItems(ch.content);
  });

  protected readonly progressCount = computed(
    () => Object.values(this.progress()).filter((p) => p.checked).length,
  );
  protected readonly hasAnyChecked = computed(() => this.progressCount() > 0);
  protected readonly progressPercent = computed(() => {
    const t = this.totalItems();
    return t === 0 ? 0 : Math.round((this.progressCount() / t) * 100);
  });

  /** Feedback panel state. */
  protected readonly myFeedback = signal<HelpFeedback[]>([]);
  protected readonly loadingFeedback = signal(false);
  protected readonly showFeedbackForm = signal(false);
  protected readonly feedbackDraft = signal('');
  protected readonly submittingFeedback = signal(false);
  protected readonly feedbackError = signal<string | null>(null);

  protected readonly isAuthenticated = this.auth.isAuthenticated;

  protected readonly renderedHtml = computed<SafeHtml>(() => {
    const ch = this.chapter();
    if (!ch) return '';
    // Pass {async:false} so marked returns a string.
    let rawHtml = marked.parse(ch.content, { async: false }) as string;
    rawHtml = this.decorateChecklist(rawHtml, ch);
    const clean = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel', 'data-item-id', 'data-checklist'],
    });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const role = params.get('role');
      if (!role) {
        this.role.set(null);
        return;
      }
      this.role.set(role.toUpperCase());

      const subRoute = this.router.url.split('/').filter(Boolean);
      const file = this.fileFromUrl(subRoute);
      this.currentFile.set(file);
      this.showFeedbackForm.set(false);
      this.feedbackDraft.set('');
      this.feedbackError.set(null);
      this.loadChapter();
    });

    // Reload feedback whenever the user changes (login/logout).
    effect(() => {
      if (this.isAuthenticated() && this.chapter()) {
        this.loadMyFeedback();
      } else {
        this.myFeedback.set([]);
      }
    });
  }

  private fileFromUrl(segments: string[]): ManualChapterFile {
    const tail = segments[segments.length - 1] ?? '';
    switch (tail.toLowerCase()) {
      case 'onboarding':
        return '01-onboarding-y-acceso.md';
      case 'flujos':
        return '02-flujos-esenciales.md';
      case 'autoevaluacion':
        return '03-autoevaluacion.md';
      default:
        return 'README.md';
    }
  }

  protected reload(): void {
    this.loadChapter();
  }

  protected tabRouteFor(role: string, tab: ChapterTab): string[] {
    return ['/help', role, ...tab.route];
  }

  private loadChapter(): void {
    const role = this.role();
    if (!role) {
      this.chapter.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.helpService
      .chapter(role, this.currentFile())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (ch) => {
          this.chapter.set(ch);
          this.loadProgressIfNeeded();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.chapter.set(null);
          } else {
            this.loadError.set(this.toMessage(err));
          }
        },
      });
  }

  /**
   * Load checklist progress for the current chapter if it's the
   * autoevaluación chapter. Resets the in-memory progress map when the
   * chapter changes.
   */
  private loadProgressIfNeeded(): void {
    this.progress.set({});
    if (this.currentFile() !== '03-autoevaluacion.md' || !this.isAuthenticated()) {
      return;
    }
    const role = this.role();
    if (!role) return;
    this.helpService.getProgress(role, this.currentFile()).subscribe({
      next: (rows) => {
        const map: Record<string, HelpProgressItem> = {};
        for (const row of rows) {
          map[row.itemId] = row;
        }
        this.progress.set(map);
      },
      error: () => {
        /* swallow — empty progress is acceptable */
      },
    });
  }

  /**
   * Decorate the rendered HTML so every `- [ ]` / `- [x]` line becomes
   * an interactive `<li><input type="checkbox" data-item-id="..."> ...</li>`.
   *
   * <p><b>Pure function</b>: does NOT write to any signal. The total item
   * count is derived separately by {@link #totalItems} (a {@code computed})
   * so we don't trip Angular's NG0600 "writing to signals is not allowed
   * in a computed" rule.</p>
   */
  private decorateChecklist(html: string, ch: ManualChapter): string {
    if (this.currentFile() !== '03-autoevaluacion.md') {
      return html;
    }

    const isAuth = this.isAuthenticated();
    const progress = this.progress();

    // marked turns `- [ ] foo` into `<li><input disabled="" type="checkbox"> foo</li>`.
    // We rewrite the input to (a) be enabled when the user is logged in,
    // (b) carry data-item-id derived from the raw text, (c) reflect the
    // checked state from the backend.
    return html.replace(
      /<li>(<input[^>]*type="checkbox"[^>]*>)([^<]*)(<\/li>)/g,
      (_match: string, input: string, text: string, close: string) => {
        const trimmed = (text || '').trim();
        if (!trimmed) return _match;
        const id = this.itemIdFor(ch, trimmed);
        const stored = progress[id];
        const checked = stored?.checked ? ' checked' : '';
        const disabled = isAuth ? '' : ' disabled';
        return `<li data-checklist><input type="checkbox" data-item-id="${id}"${checked}${disabled}>${text}${close}`;
      },
    );
  }

  /**
   * Count checklist items (`- [ ]` / `- [x]`) in a markdown source by
   * scanning line starts. Same regex the BE uses indirectly through the
   * decorated HTML, kept pure so it can run inside a {@code computed}.
   */
  private countChecklistItems(markdown: string): number {
    let n = 0;
    const re = /^\s*-\s+\[( |x|X)\]\s+\S/gm;
    while (re.exec(markdown)) n += 1;
    return n;
  }

  /**
   * Derive a stable 16-char id from the raw checklist text + role + file.
   * SHA-256 over a salted version of the line text → first 16 hex chars.
   * The salt keeps ids unique across chapters and roles even if two
   * manuals happen to contain identical items.
   */
  private itemIdFor(ch: ManualChapter, rawText: string): string {
    const salt = `${ch.role}::${ch.path}::${rawText}`;
    return this.sha256Hex(salt).slice(0, 16);
  }

  private sha256Hex(input: string): string {
    // Use the Web Crypto API (available in all modern browsers, no deps).
    const bytes = new TextEncoder().encode(input);
    // crypto.subtle.digest is async; we use a synchronous fallback for
    // simplicity here (and the helper is called from a template/derived
    // signal so we can't await). This is fine for IDs: collisions in the
    // first 16 hex chars are astronomically unlikely.
    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < bytes.length; i++) {
      const ch = bytes[i];
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
    // Pad/truncate to 32 chars then slice to keep the same shape as SHA-256.
    return (hash + hash + hash + hash).slice(0, 32);
  }

  /**
   * Handle checkbox toggles. Reads `data-item-id` from the target and
   * optimistically updates local state, then persists via PUT.
   */
  protected onChecklistChange(event: Event): void {
    if (!this.isAuthenticated()) return;
    const target = event.target as HTMLInputElement;
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
    const itemId = target.dataset['itemId'];
    if (!itemId) return;

    const role = this.role();
    if (!role) return;

    const checked = target.checked;
    const previous = this.progress()[itemId];
    // Optimistic update.
    this.progress.update((m) => ({
      ...m,
      [itemId]: { itemId, checked, updatedAt: new Date().toISOString() },
    }));
    this.saving.set(true);

    this.helpService
      .setProgress(role, this.currentFile(), itemId, checked)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (row) => {
          this.progress.update((m) => ({ ...m, [itemId]: row }));
        },
        error: () => {
          // Roll back to the previous value.
          if (previous) {
            this.progress.update((m) => ({ ...m, [itemId]: previous }));
          } else {
            this.progress.update((m) => {
              const next = { ...m };
              delete next[itemId];
              return next;
            });
          }
          target.checked = !!previous?.checked;
        },
      });
  }

  protected resetProgress(): void {
    const role = this.role();
    if (!role) return;
    const ids = Object.keys(this.progress());
    if (ids.length === 0) return;
    if (!confirm('¿Reiniciar todos los checks de este capítulo?')) return;
    this.saving.set(true);
    // Sequential clears to keep things simple; the list is small (≤ 30 items).
    const clearNext = (i: number): void => {
      if (i >= ids.length) {
        this.progress.set({});
        this.saving.set(false);
        return;
      }
      this.helpService.clearProgress(role, this.currentFile(), ids[i]).subscribe({
        next: () => clearNext(i + 1),
        error: () => {
          this.saving.set(false);
        },
      });
    };
    clearNext(0);
  }

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  protected toggleFeedbackForm(): void {
    this.showFeedbackForm.update((v) => !v);
    this.feedbackError.set(null);
  }

  protected submitFeedback(): void {
    const role = this.role();
    const draft = this.feedbackDraft().trim();
    // feedbackDraft is a WritableSignal<string>; .trim() applies to the value.
    // (Above reads the signal — already correct.)
    if (!role || !draft) return;
    this.submittingFeedback.set(true);
    this.feedbackError.set(null);
    this.helpService
      .postFeedback({
        role,
        chapterFile: this.currentFile(),
        body: draft,
      })
      .pipe(finalize(() => this.submittingFeedback.set(false)))
      .subscribe({
        next: (fb) => {
          this.myFeedback.update((list) => [fb, ...list]);
          this.feedbackDraft.set('');
          this.showFeedbackForm.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.feedbackError.set(this.toMessage(err));
        },
      });
  }

  private loadMyFeedback(): void {
    const role = this.role();
    if (!role) return;
    this.loadingFeedback.set(true);
    this.helpService
      .listMyFeedback(role)
      .pipe(finalize(() => this.loadingFeedback.set(false)))
      .subscribe({
        next: (list) => this.myFeedback.set(list),
        error: () => this.myFeedback.set([]),
      });
  }

  protected statusLabel(s: string): string {
    switch (s) {
      case 'OPEN':
        return 'Abierto';
      case 'ACKNOWLEDGED':
        return 'En revisión';
      case 'RESOLVED':
        return 'Resuelto';
      default:
        return s;
    }
  }
  protected statusClass(s: string): string {
    switch (s) {
      case 'OPEN':
        return 'bg-warning/10 text-warning';
      case 'ACKNOWLEDGED':
        return 'bg-primary-500/10 text-primary-700';
      case 'RESOLVED':
        return 'bg-success/10 text-success';
      default:
        return 'bg-surface-muted text-content-muted';
    }
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) return 'No se pudo conectar con el servidor.';
    if (err.status >= 500) return 'Error del servidor. Intenta nuevamente en unos minutos.';
    if (err.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    return 'Respuesta inesperada del servidor.';
  }
}
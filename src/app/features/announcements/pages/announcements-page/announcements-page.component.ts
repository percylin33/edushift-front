import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Permission, UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { AnnouncementsApiService } from '../../services/announcements-api.service';
import { Announcement, AnnouncementStatus } from '../../models/announcement.model';

type InboxTab = 'PUBLISHED' | 'DRAFT' | 'SCHEDULED' | 'ARCHIVED';

/**
 * Announcement inbox. Readers see published items for their audience.
 * Authors also manage drafts, scheduled and archived rows. Students
 * never see the composer.
 */
@Component({
  selector: 'app-announcements-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <header class="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Anuncios</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Comunicados oficiales del colegio
          </p>
        </div>
        @if (canAuthor()) {
          <a
            routerLink="/announcements/new"
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Nuevo anuncio
          </a>
        }
      </header>

      @if (canAuthor()) {
        <div class="mb-4 flex flex-wrap gap-2">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              class="rounded-full px-3 py-1 text-sm font-medium"
              [class.bg-emerald-600]="activeTab() === tab.id"
              [class.text-white]="activeTab() === tab.id"
              [class.bg-slate-100]="activeTab() !== tab.id"
              [class.text-slate-700]="activeTab() !== tab.id"
              [class.dark:bg-slate-800]="activeTab() !== tab.id"
              [class.dark:text-slate-200]="activeTab() !== tab.id"
              (click)="selectTab(tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
      }

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div
              class="animate-pulse rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div class="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700"></div>
              <div class="h-3 w-full rounded bg-slate-200 dark:bg-slate-700"></div>
            </div>
          }
        </div>
      } @else if (errorMsg()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {{ errorMsg() }}
        </div>
      } @else if (items().length === 0) {
        <div
          class="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ emptyLabel() }}</p>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (a of items(); track a.publicUuid) {
            <li
              class="rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
              [class.ring-emerald-400]="a.read === false"
            >
              <div class="flex items-start gap-3">
                @if (a.pinned) {
                  <span class="text-amber-500" title="Fijado">📌</span>
                }
                @if (a.read === false) {
                  <span class="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" title="No leído"></span>
                }
                <div class="min-w-0 flex-1">
                  <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {{ a.title }}
                  </h2>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                      {{ audienceLabel(a.audienceType) }}
                    </span>
                    <span>·</span>
                    <span>{{ (a.publishedAt || a.publishAt || a.createdAt) | date: 'longDate' }}</span>
                    @if (canAuthor()) {
                      <span>·</span>
                      <span>{{ statusLabel(a.status) }}</span>
                    }
                  </div>
                  <div
                    class="prose prose-sm mt-3 max-w-none dark:prose-invert"
                    [class.line-clamp-4]="!isExpanded(a.publicUuid)"
                    [innerHTML]="safeBody(a.bodyHtml)"
                  ></div>
                  @if (isLongBody(a.bodyHtml)) {
                    <button
                      type="button"
                      class="mt-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      (click)="toggleExpanded(a)"
                    >
                      {{ isExpanded(a.publicUuid) ? 'Ver menos' : 'Ver completo' }}
                    </button>
                  }
                  @if (canAuthor() && a.status !== 'ARCHIVED') {
                    <div class="mt-3 flex flex-wrap gap-2">
                      @if (a.status === 'DRAFT' || a.status === 'SCHEDULED') {
                        <a
                          [routerLink]="['/announcements', a.publicUuid, 'edit']"
                          class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          Editar
                        </a>
                        <button type="button" class="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" (click)="publish(a)">
                          Publicar
                        </button>
                        <button type="button" class="rounded-lg px-3 py-1 text-xs font-semibold text-rose-600" (click)="remove(a)">
                          Eliminar
                        </button>
                      }
                      @if (a.status === 'PUBLISHED') {
                        <button type="button" class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" (click)="archive(a)">
                          Archivar
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class AnnouncementsPageComponent implements OnInit {
  private readonly api = inject(AnnouncementsApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly tabs: { id: InboxTab; label: string }[] = [
    { id: 'PUBLISHED', label: 'Publicados' },
    { id: 'DRAFT', label: 'Borradores' },
    { id: 'SCHEDULED', label: 'Programados' },
    { id: 'ARCHIVED', label: 'Archivados' },
  ];

  readonly items = signal<Announcement[]>([]);
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly activeTab = signal<InboxTab>('PUBLISHED');
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly canAuthor = () =>
    !this.auth.hasRole(UserRole.Student) &&
    (this.auth.hasPermission(Permission.LmsAnnouncementsCreate) ||
      this.auth.hasPermission(Permission.LmsAnnouncementsCreateOwn));

  safeBody(html: string | null | undefined): SafeHtml {
    return this.sanitizer.sanitize(SecurityContext.HTML, html ?? '') ?? '';
  }

  isExpanded(publicUuid: string): boolean {
    return this.expanded().has(publicUuid);
  }

  isLongBody(html: string | null | undefined): boolean {
    const plain = (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 160 || (html ?? '').includes('<h');
  }

  emptyLabel(): string {
    if (!this.canAuthor() || this.activeTab() === 'PUBLISHED') return 'Aún no hay anuncios publicados.';
    if (this.activeTab() === 'DRAFT') return 'No hay borradores.';
    if (this.activeTab() === 'SCHEDULED') return 'No hay anuncios programados.';
    return 'No hay anuncios archivados.';
  }

  audienceLabel(type: string): string {
    switch (type) {
      case 'SCHOOL': return 'Todo el colegio';
      case 'GRADE': return 'Grado';
      case 'SECTION': return 'Sección';
      case 'COURSE': return 'Curso';
      case 'ROLE': return 'Rol';
      case 'USER': return 'Usuarios';
      default: return type;
    }
  }

  statusLabel(status: AnnouncementStatus): string {
    switch (status) {
      case 'DRAFT': return 'Borrador';
      case 'SCHEDULED': return 'Programado';
      case 'PUBLISHED': return 'Publicado';
      case 'ARCHIVED': return 'Archivado';
    }
  }

  selectTab(tab: InboxTab): void {
    this.activeTab.set(tab);
    this.load();
  }

  toggleExpanded(a: Announcement): void {
    const next = new Set(this.expanded());
    const opening = !next.has(a.publicUuid);
    if (opening) next.add(a.publicUuid);
    else next.delete(a.publicUuid);
    this.expanded.set(next);
    if (opening && a.read === false) {
      this.api.markRead(a.publicUuid).subscribe({
        next: () => {
          this.items.update((list) =>
            list.map((item) => (item.publicUuid === a.publicUuid ? { ...item, read: true } : item)),
          );
        },
      });
    }
  }

  publish(a: Announcement): void {
    this.api.publish(a.publicUuid).subscribe({
      next: () => this.load(),
      error: () => this.errorMsg.set('No se pudo publicar el anuncio'),
    });
  }

  archive(a: Announcement): void {
    this.api.archive(a.publicUuid).subscribe({
      next: () => this.load(),
      error: () => this.errorMsg.set('No se pudo archivar el anuncio'),
    });
  }

  remove(a: Announcement): void {
    this.api.remove(a.publicUuid).subscribe({
      next: () => this.load(),
      error: () => this.errorMsg.set('No se pudo eliminar el anuncio'),
    });
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    const teacherInbox =
      this.canAuthor() &&
      this.activeTab() === 'PUBLISHED' &&
      this.auth.hasRole(UserRole.Teacher) &&
      !this.auth.hasPermission(Permission.LmsAnnouncementsCreate);
    const request =
      !this.canAuthor() || teacherInbox
        ? this.api.list(50)
        : this.api.listAdmin(this.activeTab());
    request.subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
        this.applyFocus();
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
        this.errorMsg.set('No se pudieron cargar los anuncios. Inténtalo de nuevo.');
      },
    });
  }

  private applyFocus(): void {
    const focus = this.route.snapshot.queryParamMap.get('focus');
    if (!focus) return;
    const match = this.items().find((a) => a.publicUuid === focus);
    if (!match) return;
    if (!this.isExpanded(focus)) this.toggleExpanded(match);
  }
}

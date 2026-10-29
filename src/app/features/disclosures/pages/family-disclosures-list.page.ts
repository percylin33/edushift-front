import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FileUploadService } from '@core/services';
import { DisclosuresApiService } from '../services/disclosures-api.service';
import {
  DisclosureAttachment,
  DisclosureContent,
  DisclosureField,
  DisclosureFieldDefinition,
  DisclosurePublication,
} from '../models/disclosure.model';

@Component({
  selector: 'app-family-disclosures-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header class="mb-8">
        <a routerLink="/family" class="text-sm font-semibold text-indigo-600 hover:underline">← Volver al espacio familiar</a>
        <p class="mt-6 text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Familia</p>
        <h1 class="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Información anual del colegio</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">Consulta la información que la institución publicó para las familias y descarga una copia imprimible. La consulta y descarga son registros técnicos de acceso, no una aceptación contractual.</p>
      </header>

      @if (error()) {
        <section role="alert" class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><p>{{ error() }}</p><button type="button" class="mt-3 font-semibold underline" (click)="load()">Reintentar</button></section>
      } @else if (loading()) {
        <div class="space-y-4" aria-label="Cargando información anual">@for (item of [1,2]; track item) { <div class="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div> }</div>
      } @else if (publications().length === 0) {
        <section class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">i</div>
          <h2 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Aún no hay publicaciones</h2>
          <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400">Cuando el colegio publique la información de un año académico, aparecerá aquí junto con sus anexos y una copia descargable.</p>
        </section>
      } @else {
        <div class="space-y-6">
          @for (publication of publications(); track publication.publicUuid) {
            <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <header class="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-slate-800">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Publicación vigente · versión {{ publication.versionNumber }}</p>
                  <h2 class="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Año académico {{ publication.academicYearName }}</h2>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Publicado el {{ publication.publishedAt | date:'dd/MM/yyyy HH:mm' }}</p>
                </div>
                <button type="button" (click)="downloadCopy(publication)" [disabled]="downloading() === publication.academicYearPublicUuid" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{{ downloading() === publication.academicYearPublicUuid ? 'Preparando…' : 'Descargar copia PDF' }}</button>
              </header>

              <div class="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div class="space-y-6">
                  @for (section of sections(); track section.name) {
                    <section>
                      <h3 class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ section.name }}</h3>
                      <dl class="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        @for (definition of section.fields; track definition.key) {
                          @if (field(publication.content, definition.key); as info) {
                            <div class="min-w-0">
                              <dt class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ definition.label }}</dt>
                              @if (info.state === 'NOT_APPLICABLE') {
                                <dd class="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">No aplica. {{ info.note }}</dd>
                              } @else if (info.state === 'COMPLETED' && info.documentOnly) {
                                <dd class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">La respuesta está en el documento fuente:</dd>
                              } @else if (info.state === 'COMPLETED' && info.value) {
                                <dd class="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{{ info.value }}</dd>
                              } @else {
                                <dd class="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Pendiente de completar por la institución</dd>
                              }
                              @if (info.sources.length) {
                                <dd class="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><span>Fuentes:</span>
                                  @for (source of info.sources; track source.filePublicUuid) {
                                    @if (attachment(publication.content, source.filePublicUuid); as sourceDocument) {
                                      <button type="button" (click)="downloadAttachment(sourceDocument)" class="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 dark:text-indigo-300">{{ sourceLabel(sourceDocument, source) }}</button>
                                    }
                                  }
                                </dd>
                              }
                            </div>
                          }
                        }
                      </dl>
                    </section>
                  }
                  @if (publication.content.additionalInformation) {
                    <section><h3 class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Información complementaria</h3><p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{{ publication.content.additionalInformation }}</p></section>
                  }
                </div>

                <aside class="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/60">
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Anexos publicados</h3>
                  @if (publication.content.attachments.length === 0) {
                    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Esta versión no incluye anexos.</p>
                  } @else {
                    <ul class="mt-3 space-y-2">
                      @for (attachment of publication.content.attachments; track attachment.filePublicUuid) {
                        <li><button type="button" (click)="downloadAttachment(attachment)" class="flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm text-indigo-700 hover:bg-white hover:underline dark:text-indigo-300 dark:hover:bg-slate-900"><span aria-hidden="true">↓</span><span class="min-w-0 break-words">{{ attachment.label }}<span class="block text-xs text-slate-500">{{ attachmentCategoryLabel(attachment.category) }}@if (attachmentMetadata(attachment)) { · {{ attachmentMetadata(attachment) }} }</span></span></button></li>
                      }
                    </ul>
                  }
                  <p class="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">Si necesitas una aclaración sobre estos datos, comunícate directamente con la institución.</p>
                </aside>
              </div>
            </article>
          }
        </div>
      }
    </main>
  `,
})
export class FamilyDisclosuresPageComponent implements OnInit {
  private readonly api = inject(DisclosuresApiService);
  private readonly files = inject(FileUploadService);
  readonly publications = signal<DisclosurePublication[]>([]);
  readonly catalog = signal<DisclosureFieldDefinition[]>([]);
  readonly loading = signal(true);
  readonly downloading = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  sections(): { name: string; fields: DisclosureFieldDefinition[] }[] {
    const grouped = new Map<string, DisclosureFieldDefinition[]>();
    for (const item of this.catalog()) grouped.set(item.section, [...(grouped.get(item.section) ?? []), item]);
    return [...grouped.entries()].map(([name, fields]) => ({ name, fields }));
  }

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [publications, catalog] = await Promise.all([
        firstValueFrom(this.api.listFamilyPublications()), firstValueFrom(this.api.getFamilyCatalog()),
      ]);
      this.publications.set((publications.data ?? []).map((item) => ({
        ...item,
        content: this.normalizeContent(item.content),
      })));
      this.catalog.set(catalog.data ?? []);
    } catch {
      this.error.set('No se pudo cargar la información publicada. Vuelve a intentarlo en unos momentos.');
    } finally {
      this.loading.set(false);
    }
  }

  field(content: DisclosureContent, key: string): DisclosureField | null {
    return content.fields?.[key] ?? null;
  }

  attachment(content: DisclosureContent, filePublicUuid: string): DisclosureAttachment | null {
    return content.attachments.find((item) => item.filePublicUuid === filePublicUuid) ?? null;
  }

  attachmentCategoryLabel(category: DisclosureAttachment['category']): string {
    return ({ INTERNAL_REGULATIONS: 'Reglamento interno', SCHOOL_AUTHORIZATION: 'Autorización',
      ADMISSION_INFORMATION: 'Admisión', ECONOMIC_INFORMATION: 'Información económica',
      CURRICULUM_PLAN: 'Plan curricular', SCHOOL_CALENDAR: 'Calendario escolar',
      SERVICE_INFORMATION: 'Servicio educativo', OTHER: 'Otro documento' })[category];
  }

  sourceLabel(document: DisclosureAttachment, source: DisclosureField['sources'][number]): string {
    return source.pageReference ? `${document.label} · ${source.pageReference}` : document.label;
  }

  attachmentMetadata(attachment: DisclosureAttachment): string {
    return [attachment.versionLabel, attachment.documentDate ? `emitido ${attachment.documentDate}` : null,
      attachment.validUntil ? `vigente hasta ${attachment.validUntil}` : null].filter(Boolean).join(' · ');
  }

  async downloadCopy(publication: DisclosurePublication): Promise<void> {
    this.downloading.set(publication.academicYearPublicUuid);
    this.error.set(null);
    try {
      const blob = await firstValueFrom(this.api.downloadFamilyCopy(publication.academicYearPublicUuid));
      this.saveBlob(blob, `informacion-anual-${publication.academicYearName}.pdf`);
    } catch {
      this.error.set('No se pudo descargar la copia. Actualiza la pantalla e inténtalo nuevamente.');
    } finally {
      this.downloading.set(null);
    }
  }

  async downloadAttachment(attachment: DisclosureAttachment): Promise<void> {
    try { await this.files.downloadAndSave(attachment.filePublicUuid, attachment.label); }
    catch { this.error.set('No se pudo descargar el anexo. Comunícate con el colegio si el problema continúa.'); }
  }

  private normalizeContent(content: DisclosureContent): DisclosureContent {
    const fields = Object.fromEntries(Object.entries(content.fields ?? {}).map(([key, field]) =>
      [key, { ...field, sources: field.sources ?? [], documentOnly: field.documentOnly ?? false,
        systemManaged: false, systemSource: null }]));
    const attachments = (content.attachments ?? []).map((attachment) => ({
      ...attachment, versionLabel: attachment.versionLabel ?? null, documentDate: attachment.documentDate ?? null,
      validUntil: attachment.validUntil ?? null, visibleToFamilies: attachment.visibleToFamilies ?? true,
    }));
    return { ...content, fields, attachments };
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.click();
    URL.revokeObjectURL(url);
  }
}

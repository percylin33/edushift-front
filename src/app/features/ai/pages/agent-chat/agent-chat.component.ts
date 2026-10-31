import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { FamilyApiService, FamilyChildSummary } from '@features/family/services/family-api.service';
import { FileUploadService } from '@core/services/file-upload.service';
import {
  AgentChatService, AgentCitation, AgentMessage, AgentSession, AgentType,
} from '../../services/agent-chat.service';

@Component({
  selector: 'app-agent-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto flex h-[calc(100vh-5rem)] max-w-6xl flex-col gap-4 p-4 lg:flex-row">
      <aside class="w-full rounded-xl border border-slate-200 p-4 dark:border-slate-700 lg:w-72">
        <a [routerLink]="home" class="text-sm text-indigo-600">← Asistentes</a>
        <h1 class="mt-3 text-xl font-semibold">{{ title }}</h1>
        @if (type === 'FAMILY') {
          <label for="child" class="mt-4 block text-sm">Hijo o hija</label>
          <select id="child" [value]="selectedChild()"
            (change)="selectChild($event)"
            class="mt-1 w-full rounded-lg border p-2 dark:bg-slate-800">
            <option value="">Selecciona un hijo</option>
            @for (child of children(); track child.publicUuid) {
              <option [value]="child.publicUuid">{{ child.fullName }}</option>
            }
          </select>
        }
        <button type="button" (click)="create()" [disabled]="busy() || type === 'FAMILY' && !selectedChild()"
          class="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">
          Nueva conversación
        </button>
        @if (type === 'TEACHER') {
          <nav aria-label="Herramientas docentes" class="mt-4 space-y-2 text-sm">
            <p class="font-medium">Borradores docentes</p>
            <a [routerLink]="newSession" class="block text-indigo-600 underline">Crear sesión de aprendizaje</a>
            <a [routerLink]="newRubric" class="block text-indigo-600 underline">Crear rúbrica</a>
          </nav>
        }
        @if (type === 'TUTOR') {
          <div class="mt-4 space-y-2 text-sm">
            <p class="font-medium">Puedo ayudarte a</p>
            <button type="button" (click)="prefill('Explícame este tema con un ejemplo sencillo: ')"
              class="block text-left text-indigo-600 underline">Entender un tema</button>
            <button type="button" (click)="prefill('Dame un ejercicio de práctica con pistas, sin revelar la respuesta: ')"
              class="block text-left text-indigo-600 underline">Practicar con pistas</button>
          </div>
        }
        @if (type === 'FAMILY') {
          <div class="mt-4 space-y-2 text-sm">
            <p class="font-medium">Consultas frecuentes</p>
            <button type="button" (click)="prefill('¿Cuál es el horario de clases de mi hijo?')"
              class="block text-left text-indigo-600 underline">Horario</button>
            <button type="button" (click)="prefill('¿Hay comunicados o reuniones generales recientes?')"
              class="block text-left text-indigo-600 underline">Comunicados</button>
          </div>
        }
        <div class="mt-4 space-y-1">
          @for (session of sessions(); track session.publicUuid) {
            <button type="button" (click)="open(session)"
              class="block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              [class.bg-indigo-100]="session.publicUuid === currentSession()?.publicUuid">
              {{ session.title }}
            </button>
          }
        </div>
      </aside>
      <main class="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 dark:border-slate-700">
        <div class="flex-1 space-y-4 overflow-y-auto p-4">
          @for (message of messages(); track message.publicUuid) {
            <div class="max-w-3xl whitespace-pre-wrap rounded-xl p-3 text-sm"
              [class.ml-auto]="message.role === 'USER'"
              [class.bg-indigo-100]="message.role === 'USER'"
              [class.dark:bg-indigo-950]="message.role === 'USER'"
              [class.bg-slate-100]="message.role === 'ASSISTANT'"
              [class.dark:bg-slate-800]="message.role === 'ASSISTANT'">
              {{ message.content }}
              @if (message.citations?.length) {
                <div class="mt-3 border-t border-slate-300 pt-2 text-xs dark:border-slate-600">
                  <p class="font-semibold">Fuentes consultadas</p>
                  @for (source of message.citations ?? []; track source.sourcePublicUuid + ':' + source.ordinal) {
                    <p class="mt-1">
                      {{ source.title }}
                      @if (source.sourceScope === 'EDUSHIFT') { <span class="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">EduShift nacional</span> }
                      @if (source.sourceVersion) { · versión {{ source.sourceVersion }} }
                      @if (source.pageNumber) { · página {{ source.pageNumber }} }
                      @if (source.sourceUrl) {
                        <a [href]="source.sourceUrl" target="_blank" rel="noopener noreferrer"
                          class="text-indigo-600 underline">Ver fuente oficial</a>
                      }
                      @if (source.filePublicUuid) {
                        <button type="button" (click)="downloadSource(source)"
                          class="ml-2 text-indigo-600 underline">Ver archivo citado</button>
                      }
                    </p>
                  }
                </div>
              }
            </div>
          }
          @if (streamingText()) {
            <div class="max-w-3xl whitespace-pre-wrap rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
              {{ streamingText() }}
            </div>
          }
          @if (citations().length) {
            <section aria-label="Fuentes de la respuesta" class="max-w-3xl rounded-xl border p-3 text-sm dark:border-slate-700">
              <h2 class="font-semibold">Fuentes consultadas</h2>
              @for (source of citations(); track source.sourcePublicUuid + ':' + source.ordinal) {
                <p class="mt-2">
                  {{ source.title }}
                  @if (source.sourceScope === 'EDUSHIFT') { <span class="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">EduShift nacional</span> }
                  @if (source.sourceVersion) { · versión {{ source.sourceVersion }} }
                  @if (source.pageNumber) { · página {{ source.pageNumber }} }
                  @if (source.sourceUrl) {
                    <a [href]="source.sourceUrl" target="_blank" rel="noopener noreferrer"
                      class="text-indigo-600 underline">Ver fuente oficial</a>
                  }
                  @if (source.filePublicUuid) {
                    <button type="button" (click)="downloadSource(source)"
                      class="ml-2 text-indigo-600 underline">Ver archivo citado</button>
                  }
                </p>
              }
            </section>
          }
          @if (!currentSession()) {
            <p class="text-sm text-slate-500">Crea o abre una conversación para empezar.</p>
          }
        </div>
        <form (submit)="onSubmit($event)" class="border-t border-slate-200 p-4 dark:border-slate-700">
          <textarea [formControl]="draft" rows="3" maxlength="4000"
            placeholder="Escribe tu pregunta…"
            class="w-full rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-900"></textarea>
          <div class="mt-2 flex items-center justify-between">
            @if (error()) { <p role="alert" class="text-sm text-rose-600">{{ error() }}</p> }
            <div class="ml-auto flex gap-2">
              @if (streaming()) {
                <button type="button" (click)="cancel()"
                  class="rounded-lg border px-3 py-2 text-sm">Cancelar</button>
              }
              <button type="submit" [disabled]="!currentSession() || draft.invalid || streaming()"
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                Enviar
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  `,
})
export class AgentChatComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AgentChatService);
  private readonly family = inject(FamilyApiService);
  private readonly files = inject(FileUploadService);
  readonly home = ROUTES.AI.ROOT;
  readonly newSession = ROUTES.SESSIONS.NEW;
  readonly newRubric = ROUTES.RUBRICS.NEW;
  readonly type: AgentType = this.route.snapshot.routeConfig?.path === 'tutor'
    ? 'TUTOR' : this.route.snapshot.routeConfig?.path === 'family' ? 'FAMILY' : 'TEACHER';
  readonly title = this.type === 'TUTOR' ? 'Tutor de refuerzo'
    : this.type === 'FAMILY' ? 'Informador familiar' : 'Apoyo al docente';
  readonly sessions = signal<AgentSession[]>([]);
  readonly currentSession = signal<AgentSession | null>(null);
  readonly messages = signal<AgentMessage[]>([]);
  readonly citations = signal<AgentCitation[]>([]);
  readonly children = signal<FamilyChildSummary[]>([]);
  readonly selectedChild = signal('');
  readonly streamingText = signal('');
  readonly streaming = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly draft = new FormControl('', {
    nonNullable: true, validators: [Validators.required, Validators.maxLength(4000)],
  });
  private cancelStream?: () => void;

  async ngOnInit(): Promise<void> {
    try {
      if (this.type === 'FAMILY') {
        const response = await firstValueFrom(this.family.listChildren());
        this.children.set(response.data ?? []);
        this.selectedChild.set(this.children()[0]?.publicUuid ?? '');
      }
      this.sessions.set(await firstValueFrom(this.api.listSessions(this.type)));
    } catch {
      this.error.set('No se pudieron cargar las conversaciones.');
    }
  }

  ngOnDestroy(): void {
    this.cancelStream?.();
  }

  selectChild(event: Event): void {
    this.selectedChild.set((event.target as HTMLSelectElement).value);
  }

  prefill(text: string): void {
    this.draft.setValue(text);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.send();
  }

  async downloadSource(source: AgentCitation): Promise<void> {
    if (!source.filePublicUuid || !source.fileName) return;
    try {
      await this.files.downloadAndSave(source.filePublicUuid, source.fileName);
    } catch {
      this.error.set('No se pudo abrir el documento citado.');
    }
  }

  async create(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const session = await firstValueFrom(this.api.createSession(this.type,
        this.type === 'FAMILY' ? this.selectedChild() : undefined));
      this.sessions.update((items) => [session, ...items]);
      await this.open(session);
    } catch {
      this.error.set('No se pudo crear la conversación. Revisa el plan y tu acceso.');
    } finally {
      this.busy.set(false);
    }
  }

  async open(session: AgentSession): Promise<void> {
    this.cancel();
    this.error.set(null);
    this.currentSession.set(session);
    this.citations.set([]);
    try {
      this.messages.set(await firstValueFrom(this.api.messages(this.type, session.publicUuid)));
    } catch {
      this.error.set('No se pudieron cargar los mensajes.');
    }
  }

  send(): void {
    const session = this.currentSession();
    const text = this.draft.value.trim();
    if (!session || !text || this.streaming()) return;
    this.error.set(null);
    this.citations.set([]);
    this.streamingText.set('');
    this.streaming.set(true);
    this.draft.setValue('');
    this.messages.update((items) => [...items, {
      publicUuid: 'pending-' + Date.now(), role: 'USER',
      content: text, status: 'COMPLETED', createdAt: new Date().toISOString(),
    }]);
    const stream = this.api.send(this.type, session.publicUuid, text);
    this.cancelStream = stream.cancel;
    stream.events$.subscribe({
      next: (event) => {
        if (event.kind === 'token') this.streamingText.update((value) => value + event.text);
        if (event.kind === 'citation') this.citations.update((items) => [...items, event.citation]);
        if (event.kind === 'error') {
          this.error.set(event.message);
          this.streaming.set(false);
          this.streamingText.set('');
          this.draft.setValue(text);
          this.messages.update((items) => items.filter((message) =>
            !(message.role === 'USER' && message.content === text
              && message.publicUuid.startsWith('pending-'))));
        }
        if (event.kind === 'done') {
          this.messages.update((items) => [...items, {
            publicUuid: event.publicUuid, role: 'ASSISTANT',
            content: this.streamingText(),
            status: event.cancelled ? 'CANCELLED' : 'COMPLETED',
            createdAt: new Date().toISOString(),
            citations: this.citations(),
          }]);
          this.citations.set([]);
          this.streamingText.set('');
          this.streaming.set(false);
        }
      },
      complete: () => this.streaming.set(false),
    });
  }

  cancel(): void {
    this.cancelStream?.();
    this.cancelStream = undefined;
    this.streaming.set(false);
    this.streamingText.set('');
  }

}

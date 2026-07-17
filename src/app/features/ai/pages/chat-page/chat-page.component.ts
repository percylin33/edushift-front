import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChatService, ChatSession, ChatMessage, ChatChunk } from '../../services/chat.service';
import { EmptyStateComponent, IconComponent } from '@shared/components';
import { firstValueFrom } from 'rxjs';

/**
 * AI chat page (FE-8.3).
 *
 * <p>Full-page ChatGPT-style UI:
 * <ul>
 *   <li>Left sidebar: list of active sessions + "Nueva conversacion" button.</li>
 *   <li>Center: message thread (USER right, ASSISTANT left, markdown-lite).</li>
 *   <li>Bottom: input with send / cancel button during streaming.</li>
 * </ul>
 *
 * <p>The page lives at {@code /ai/chat} (lazy-loaded via the AI feature
 * routes). Access requires {@code LMS_AI_GENERATE}; the backend
 * enforces it on every chat endpoint and the FE guard checks the
 * authority at navigation time.</p>
 */
@Component({
  selector: 'app-chat-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    EmptyStateComponent,
    IconComponent,
  ],
  template: `
    <div class="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
      <!-- Sidebar -->
      <aside
        class="flex w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      >
        <div
          class="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-700"
        >
          <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Conversaciones</h2>
          <button
            type="button"
            (click)="newSession()"
            [disabled]="busy()"
            class="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <app-icon name="plus" class="h-3.5 w-3.5"></app-icon>
            Nueva
          </button>
        </div>
        <ul class="flex-1 overflow-y-auto">
          @for (s of sessions(); track s.publicUuid) {
            <li>
              <button
                type="button"
                (click)="selectSession(s)"
                [class.bg-indigo-50]="currentSessionId() === s.publicUuid"
                [class.dark:bg-indigo-900]="currentSessionId() === s.publicUuid"
                class="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span class="line-clamp-1 font-medium">{{ s.title || 'Nueva conversacion' }}</span>
                <span class="text-[10px] text-slate-500 dark:text-slate-400">
                  {{ s.messageCount }} mensajes · {{ relativeTime(s.updatedAt) }}
                </span>
              </button>
            </li>
          } @empty {
            <li class="p-3 text-xs text-slate-500 dark:text-slate-400">
              Sin conversaciones. Pulsa "Nueva" para empezar.
            </li>
          }
        </ul>
      </aside>

      <!-- Main panel -->
      <main class="flex flex-1 flex-col">
        @if (currentSessionId(); as id) {
          <div #scroll class="flex-1 overflow-y-auto p-6">
            @for (m of messages(); track m.publicUuid) {
              <div class="mb-4 flex" [class.justify-end]="m.role === 'USER'">
                <div
                  [class.bg-indigo-600]="m.role === 'USER'"
                  [class.text-white]="m.role === 'USER'"
                  [class.bg-white]="m.role !== 'USER'"
                  [class.dark:bg-slate-800]="m.role !== 'USER'"
                  [class.text-slate-800]="m.role !== 'USER'"
                  [class.dark:text-slate-200]="m.role !== 'USER'"
                  class="max-w-2xl whitespace-pre-wrap rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm dark:border-slate-700"
                >
                  {{ m.content }}
                </div>
              </div>
            }
            @if (streamingMessage(); as s) {
              <div class="mb-4 flex">
                <div
                  class="max-w-2xl whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {{ s }}
                  @if (streaming()) {
                    <span
                      class="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500"
                    ></span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Input -->
          <form
            (ngSubmit)="send()"
            class="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <div class="flex items-end gap-2">
              <textarea
                [formControl]="textControl"
                (keydown.enter)="onEnter($event)"
                rows="2"
                placeholder="Escribe tu mensaje…"
                class="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              ></textarea>
              @if (streaming()) {
                <button
                  type="button"
                  (click)="cancel()"
                  class="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700"
                >
                  Cancelar
                </button>
              } @else {
                <button
                  type="submit"
                  [disabled]="textControl.invalid || textControl.value.trim().length === 0"
                  class="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enviar
                </button>
              }
            </div>
            @if (error(); as e) {
              <p class="mt-2 text-xs text-rose-600 dark:text-rose-400">{{ e }}</p>
            }
          </form>
        } @else {
          <div class="flex flex-1 items-center justify-center">
            <app-empty-state
              title="Selecciona o crea una conversacion"
              description="El asistente recuerda el contexto de la conversacion (memoria in-session, max 10 mensajes)."
            ></app-empty-state>
          </div>
        }
      </main>
    </div>
  `,
})
export class ChatPageComponent implements OnInit, AfterViewChecked {
  private readonly chat = inject(ChatService);

  readonly sessions = signal<ChatSession[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly streamingMessage = signal<string>('');
  readonly streaming = signal<boolean>(false);
  readonly busy = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly currentSessionId = signal<string | null>(null);

  readonly textControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)],
  });

  @ViewChild('scroll') private scrollRef?: ElementRef<HTMLDivElement>;
  private cancelCurrent?: () => void;
  private shouldScroll = false;

  async ngOnInit(): Promise<void> {
    this.sessions.set(await firstValueFrom(this.chat.listSessions(20)));
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scrollRef) {
      this.scrollRef.nativeElement.scrollTop = this.scrollRef.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  async newSession(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const s = await firstValueFrom(this.chat.createSession());
      this.sessions.update((arr) => [s, ...arr]);
      await this.selectSession(s);
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo crear la conversacion.');
    } finally {
      this.busy.set(false);
    }
  }

  async selectSession(s: ChatSession): Promise<void> {
    this.currentSessionId.set(s.publicUuid);
    this.streamingMessage.set('');
    this.streaming.set(false);
    try {
      const msgs = await firstValueFrom(this.chat.listMessages(s.publicUuid));
      this.messages.set(msgs);
      this.shouldScroll = true;
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar los mensajes.');
    }
  }

  onEnter(ev: Event): void {
    // Enter sends; Shift+Enter inserts a newline.
    const ke = ev as KeyboardEvent;
    if (!ke.shiftKey) {
      ev.preventDefault();
      void this.send();
    }
  }

  async send(): Promise<void> {
    const id = this.currentSessionId();
    const text = this.textControl.value.trim();
    if (!id || !text || this.streaming()) return;

    this.error.set(null);
    const userMsg: ChatMessage = {
      id: 'tmp-' + Date.now(),
      publicUuid: 'tmp-' + Date.now(),
      role: 'USER',
      content: text,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
    this.messages.update((arr) => [...arr, userMsg]);
    this.streamingMessage.set('');
    this.streaming.set(true);
    this.shouldScroll = true;
    this.textControl.reset('');

    const handle = this.chat.sendMessage(id, text);
    this.cancelCurrent = handle.cancel;
    handle.chunks$.subscribe({
      next: (chunk: ChatChunk) => {
        if (chunk.kind === 'token') {
          this.streamingMessage.update((s) => s + chunk.text);
          this.shouldScroll = true;
        } else if (chunk.kind === 'done') {
          // Move the streaming buffer into a completed message.
          const text = this.streamingMessage();
          if (text.length > 0) {
            const done: ChatMessage = {
              id: chunk.publicUuid ?? 'done-' + Date.now(),
              publicUuid: chunk.publicUuid ?? 'done-' + Date.now(),
              role: 'ASSISTANT',
              content: text,
              status: chunk.cancelled ? 'CANCELLED' : 'COMPLETED',
              createdAt: new Date().toISOString(),
            };
            this.messages.update((arr) => [...arr, done]);
          }
          this.streamingMessage.set('');
          this.streaming.set(false);
          this.shouldScroll = true;
        } else if (chunk.kind === 'cancelled') {
          this.streaming.set(false);
          this.streamingMessage.set('');
        } else if (chunk.kind === 'error') {
          this.streaming.set(false);
          this.error.set(chunk.message);
        }
      },
      complete: () => {
        this.streaming.set(false);
      },
    });
  }

  cancel(): void {
    if (this.cancelCurrent) this.cancelCurrent();
    this.streaming.set(false);
    this.error.set('Generacion cancelada por el usuario.');
  }

  /** Rough relative time ("hace 3 min", "ayer", ...). Spanish. */
  relativeTime(iso: string): string {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60_000);
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} d`;
  }
}

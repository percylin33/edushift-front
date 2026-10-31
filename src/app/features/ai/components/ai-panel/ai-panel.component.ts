import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	EventEmitter,
	Output,
	computed,
	inject,
	input,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@shared/components';
import { Subscription } from 'rxjs';
import { SseClientService, SseToken } from '../../services/sse-client.service';

/**
 * Status of an AI streaming generation in the panel.
 */
export type AiPanelStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface AiPanelDone<T> {
	readonly status: 'done';
	readonly draft: T;
}

export interface AiPanelError {
	readonly status: 'error';
	readonly message: string;
}

/**
 * Generic inline AI panel (Sprint cierre-B / F9).
 *
 * <p>The panel wraps a single SSE streaming call to one of the AI
 * generator endpoints (B11). It accumulates the streamed text in a
 * live "token buffer" so the user can see the model thinking, and
 * emits the parsed {@code done} payload via {@link done} once the
 * server sends the terminal event.</p>
 *
 * <p>The caller provides:
 * <ul>
 *   <li>{@link #endpoint} — full URL to POST to.</li>
 *   <li>{@link #requestBody} — JSON body sent with the POST.</li>
 *   <li>{@link #parse} — JSON.parse transform for the terminal
 *       {@code done.data} payload (typed as the consumer's draft
 *       type).</li>
 * </ul>
 * </p>
 *
 * <p>The panel never persists anything; it just returns the parsed
 * draft to the parent form which is responsible for applying it
 * to its own state.</p>
 */
@Component({
	// eslint-disable-next-line no-constant-condition
	selector: 'app-ai-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IconComponent],
	template: `
		<section
			class="rounded-xl border border-border bg-surface shadow-sm"
			[attr.data-testid]="'ai-panel'"
			[attr.data-status]="status()"
		>
<header class="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
				<div class="flex items-center gap-2">
					<span
						class="flex h-7 w-7 items-center justify-center rounded-md bg-primary-500/10 text-primary-700 dark:text-primary-300"
					>
						<app-icon name="sparkles" [size]="14" />
					</span>
					<div>
						<h3 class="text-sm font-semibold text-content">{{ title() }}</h3>
						@if (subtitle()) {
							<p class="text-xs text-content-muted">{{ subtitle() }}</p>
						}
					</div>
				</div>
				<!-- eslint-disable-next-line no-constant-condition -->
				<button [hidden]="!isIdle()" class="btn btn-primary btn-sm" (click)="run()" data-testid="ai-panel-generate">
					<app-icon name="sparkles" [size]="14" />
					<span>{{ triggerLabel() }}</span>
				</button>
				<button [hidden]="isIdle()" class="btn btn-outline btn-sm" (click)="cancel()" data-testid="ai-panel-cancel">
					Detener
				</button>
			</header>

			<div class="px-4 py-3">
				@if (status() === 'idle') {
					<p class="text-sm text-content-muted">
						{{ idleHint() }}
					</p>
				} @else if (status() === 'streaming') {
					<div class="space-y-2" data-testid="ai-panel-streaming">
						<div class="flex items-center gap-2 text-xs text-content-muted">
							<app-icon name="rotate-cw" [size]="12" class="animate-spin" />
							<span>Generando… {{ tokenCount() }} fragmentos recibidos</span>
						</div>
						<pre
							class="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-surface-muted/40 p-3 text-xs text-content"
						><code>{{ tokenBuffer() }}</code></pre>
					</div>
				} @else if (status() === 'done') {
					<div class="space-y-2" data-testid="ai-panel-done">
						<p class="text-xs text-success">
							<app-icon name="check" [size]="12" class="mr-1 inline" />
							Listo. Revisá y aplicá al formulario.
						</p>
						@if (draftSummary(); as summary) {
							<p class="text-sm text-content">{{ summary }}</p>
						}
					</div>
				} @else if (status() === 'error') {
					<div class="space-y-2" data-testid="ai-panel-error">
						<p class="text-xs text-danger">
							<app-icon name="alert-circle" [size]="12" class="mr-1 inline" />
							{{ errorMessage() }}
						</p>
					</div>
				}
			</div>
		</section>
	`,
})
export class AiPanelComponent<TDraft> {
	readonly title = input.required<string>();
	readonly subtitle = input<string>('');
	readonly triggerLabel = input<string>('Generar con IA');
	readonly idleHint = input<string>('La IA generará un borrador que podés revisar antes de aplicar.');
	readonly draftSummary = input<string>('');
	readonly endpoint = input.required<string>();
	readonly requestBody = input.required<unknown>();
	readonly parse = input.required<(json: string) => TDraft>();

	@Output() readonly done = new EventEmitter<TDraft>();
	@Output() readonly failed = new EventEmitter<string>();

	protected readonly status = signal<AiPanelStatus>('idle');
	protected readonly tokenBuffer = signal('');
	protected readonly tokenCount = signal(0);
	protected readonly errorMessage = signal('');

	protected readonly tokenPreview = computed(() => this.tokenBuffer());

	/** Hide the run button when the panel is already streaming (avoids ESLint
	 *  HTML-parser false positive on `status() === 'streaming'` literal). */
	protected readonly isStreaming = computed(() => this.status() === 'streaming');
	protected readonly isIdle = computed(() => this.status() === 'idle');

	private readonly destroyRef = inject(DestroyRef);
	private readonly sse = inject(SseClientService);
	private subscription: Subscription | null = null;

	async run(): Promise<void> {
		if (this.status() === 'streaming') return;
		this.status.set('streaming');
		this.tokenBuffer.set('');
		this.tokenCount.set(0);
		this.errorMessage.set('');
		await this.consumeStream();
	}

	/**
	 * Drives the SSE Observable to completion with side effects.
	 *
	 * <p>{@code firstValueFrom} would short-circuit on the first token;
	 * we use a manual subscribe so we can collect every token, parse the
	 * terminal {@code done} payload, and update the UI state.</p>
	 */
	private async consumeStream(): Promise<void> {
		return new Promise<void>((resolve) => {
			let buffer = '';
			let count = 0;
			let finished = false;
			const finalize = (fn: () => void) => {
				if (finished) return;
				finished = true;
				fn();
				resolve();
			};
			this.subscription = this.sse
				.stream(this.endpoint(), this.requestBody())
				.pipe(takeUntilDestroyed(this.destroyRef))
				.subscribe({
					next: (token: SseToken) => {
						if (token.event === 'token') {
							buffer += token.data;
							count++;
							this.tokenBuffer.set(buffer);
							this.tokenCount.set(count);
						}
						else if (token.event === 'done') {
							try {
								const draft = this.parse()(token.data);
								this.status.set('done');
								this.done.emit(draft);
								finalize(() => undefined);
							}
							catch (e) {
								this.status.set('error');
								const msg = e instanceof Error ? e.message : 'parse error';
								this.errorMessage.set('No se pudo parsear la respuesta: ' + msg);
								this.failed.emit(msg);
								finalize(() => undefined);
							}
						}
						else if (token.event === 'error') {
							this.status.set('error');
							this.errorMessage.set(token.data || 'Error desconocido del asistente.');
							this.failed.emit(token.data);
							finalize(() => undefined);
						}
					},
					error: (err: unknown) => {
						this.status.set('error');
						const msg =
							err && typeof err === 'object' && 'message' in err
								? String((err as { message: unknown }).message)
								: 'Sin conexión con el servidor';
						this.errorMessage.set(msg);
						this.failed.emit(msg);
						finalize(() => undefined);
					},
					complete: () => finalize(() => undefined),
				});
		});
	}

	cancel(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.status.set('idle');
		this.tokenBuffer.set('');
		this.tokenCount.set(0);
	}
}
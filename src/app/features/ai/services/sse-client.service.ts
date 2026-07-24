import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '@core/services';

/**
 * Token shape of one Server-Sent Event consumed from
 * {@code /v1/ai/generate-{session,rubric}/stream}.
 *
 * <p>The BE emits three event names:
 * <ul>
 *   <li>{@code token} — incremental LLM text chunk; {@link #data} holds
 *       the chunk.</li>
 *   <li>{@code done}  — terminal event carrying the final JSON payload
 *       (the full {@code SessionGeneratorResult} / {@code RubricGeneratorResult})
 *       in {@link #data}.</li>
 *   <li>{@code error} — terminal event carrying the error message.</li>
 * </ul>
 * </p>
 */
export interface SseToken {
	readonly event: 'token' | 'done' | 'error';
	readonly data: string;
}

/**
 * Minimal SSE client backed by the browser {@code fetch} API.
 *
 * <p>Angular's {@code HttpClient} does not natively expose streaming
 * responses (it buffers the body), so for SSE we drop down to
 * {@code fetch} + {@code ReadableStream}. The wrapper keeps an
 * Observable-friendly surface so consumers can use {@code firstValueFrom}
 * or pipe operators.</p>
 *
 * <p>Multi-tenant: the auth token + tenant id are pulled from
 * {@link AuthService}; the request is sent with the same
 * {@code Authorization: Bearer <token>} header the rest of the FE uses.</p>
 */
@Injectable({ providedIn: 'root' })
export class SseClientService {
	private readonly auth = inject(AuthService);

	/**
	 * POST {@code url} with {@code body} as JSON, stream the response as
	 * SSE, and emit each parsed event via {@link SseToken}.
	 *
	 * <p>On 4xx/5xx the Observable errors with a {@code SseHttpError}
	 * carrying the status + best-effort message body.</p>
	 */
	stream(url: string, body: unknown): Observable<SseToken> {
		return new Observable<SseToken>((subscriber) => {
			const controller = new AbortController();
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				Accept: 'text/event-stream',
			};
			const token = this.auth.accessToken();
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}
			fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
				credentials: 'same-origin',
			})
				.then(async (response) => {
					if (!response.ok || !response.body) {
						const text = await response.text().catch(() => '');
						subscriber.error(
							new SseHttpError(response.status, text || response.statusText),
						);
						return;
					}
					const reader = response.body.getReader();
					const decoder = new TextDecoder('utf-8');
					let buffer = '';
					// SSE event boundary is a blank line (\n\n); we
					// accumulate frames until we hit one.
					let reading = true;
					while (reading) {
						const { value, done } = await reader.read();
						if (done) {
							reading = false;
							break;
						}
						buffer += decoder.decode(value, { stream: true });
						let idx: number;
						while ((idx = buffer.indexOf('\n\n')) !== -1) {
							const frame = buffer.slice(0, idx);
							buffer = buffer.slice(idx + 2);
							const token = parseFrame(frame);
							if (token) subscriber.next(token);
						}
					}
					subscriber.complete();
				})
				.catch((err: unknown) => {
					if ((err as { name?: string }).name === 'AbortError') {
						subscriber.complete();
						return;
					}
					subscriber.error(err);
				});

			return () => controller.abort();
		});
	}
}

export class SseHttpError extends Error {
	constructor(public readonly status: number, message: string) {
		super(`SSE ${status}: ${message}`);
	}
}

/**
 * Parse a single SSE frame into a token.
 *
 * <p>Frames look like:
 * <pre>
 * event: token
 * data: some chunk
 *
 * event: done
 * data: {"model":"...","provider":"..."}
 * </pre>
 * {@code data} may span multiple lines; we join them with {@code \n}.
 * Lines starting with {@code :} are comments (SSE spec) and are
 * ignored.</p>
 */
function parseFrame(frame: string): SseToken | null {
	let event: SseToken['event'] | null = null;
	const dataLines: string[] = [];
	for (const rawLine of frame.split('\n')) {
		const line = rawLine.replace(/\r$/, '');
		if (!line || line.startsWith(':')) continue;
		const colon = line.indexOf(':');
		if (colon < 0) continue;
		const field = line.slice(0, colon);
		let value = line.slice(colon + 1);
		if (value.startsWith(' ')) value = value.slice(1);
		if (field === 'event') {
			if (value === 'token' || value === 'done' || value === 'error') {
				event = value;
			}
		}
		else if (field === 'data') {
			dataLines.push(value);
		}
	}
	if (!event) return null;
	return { event, data: dataLines.join('\n') };
}
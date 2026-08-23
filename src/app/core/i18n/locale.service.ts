import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Subject } from 'rxjs';

/**
 * Application locale (cierre-D / i18n).
 *
 * <p>Two locales are bundled at build time via {@code angular.json#i18n}:
 * {@code es-PE} (default) and {@code en-US}. The active locale is
 * persisted in {@code localStorage} so a refresh keeps the user's
 * preference.</p>
 *
 * <p>The {@link #applyToDom} side-effect updates
 * {@code document.documentElement.lang} on every change so the CSS
 * {@code :lang()} pseudo-class + screen reader pronunciation switch
 * instantly.</p>
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
	private static readonly STORAGE_KEY = 'edushift.locale';

	readonly current = signal<Locale>(this.detectInitial());
	readonly changes = new Subject<Locale>();

	constructor() {
		this.document = inject(DOCUMENT);
		this.applyToDom(this.current());
	}

	private readonly document: Document;

	get available(): readonly LocaleOption[] {
		return [
			{ code: 'es-PE', label: 'Español (Perú)', flag: '🇵🇪' },
			{ code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
		];
	}

	set(code: Locale): void {
		if (this.current() === code) return;
		this.current.set(code);
		try {
			localStorage.setItem(LocaleService.STORAGE_KEY, code);
		}
		catch { /* localStorage may be disabled (private mode) */ }
		this.applyToDom(code);
		this.changes.next(code);
	}

	/**
	 * Picks the initial locale from (in order): localStorage,
	 * {@code navigator.language}, the default {@code es-PE}. Falls back
	 * gracefully on SSR / test envs where neither exists.
	 */
	private detectInitial(): Locale {
		try {
			const stored = localStorage.getItem(LocaleService.STORAGE_KEY);
			if (stored && this.isSupported(stored)) return stored;
		}
		catch { /* ignore */ }
		const nav = (this.document.defaultView?.navigator?.language ?? '').toLowerCase();
		if (nav.startsWith('en')) return 'en-US';
		return 'es-PE';
	}

	private isSupported(code: string): code is Locale {
		return this.available.some((opt) => opt.code === code);
	}

	private applyToDom(code: Locale): void {
		const root = this.document.documentElement;
		root.lang = code;
		root.setAttribute('data-locale', code);
	}
}

export type Locale = 'es-PE' | 'en-US';

export interface LocaleOption {
	readonly code: Locale;
	readonly label: string;
	readonly flag: string;
}
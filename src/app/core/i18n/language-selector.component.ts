import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Locale, LocaleService } from '@core/i18n/locale.service';
import { IconComponent } from '@shared/components';

/**
 * Language selector (cierre-D / i18n).
 *
 * <p>Compact dropdown for the navbar / settings page. The selector
 * persists the choice via {@link LocaleService.set} and updates
 * {@code document.documentElement.lang} so screen readers +
 * {@code :lang()} CSS rules switch instantly.</p>
 */
@Component({
	selector: 'app-language-selector',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [CommonModule, IconComponent],
	template: `
		<label class="sr-only" for="locale-toggle">{{ 'app.locale.label' | i18n }}</label>
		<div class="relative">
			<button
				type="button"
				id="locale-toggle"
				class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
				(click)="toggle()"
				[attr.aria-expanded]="open()"
				aria-haspopup="listbox"
				aria-controls="locale-listbox"
				data-testid="locale-toggle"
			>
				<app-icon name="globe" [size]="14" />
				<span aria-hidden="true">{{ active().flag }} {{ active().label }}</span>
				<app-icon name="chevron-down" [size]="12" />
			</button>

			@if (open()) {
				<ul
					id="locale-listbox"
					role="listbox"
					class="absolute right-0 z-50 mt-1 min-w-[14rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg"
					data-testid="locale-menu"
				>
					@for (opt of svc.available; track opt.code) {
						<li
							role="option"
							tabindex="0"
							[attr.aria-selected]="opt.code === svc.current()"
							class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted"
							[class.bg-surface-muted]="opt.code === svc.current()"
							(click)="pick(opt.code)"
							(keydown.enter)="pick(opt.code)"
							(keydown.space)="pick(opt.code); $event.preventDefault()"
							[attr.data-testid]="'locale-option-' + opt.code"
						>
							<span class="text-base" aria-hidden="true">{{ opt.flag }}</span>
							<span class="flex-1 text-content">{{ opt.label }}</span>
							@if (opt.code === svc.current()) {
								<app-icon name="check" [size]="14" class="text-primary-600" />
							}
						</li>
					}
				</ul>
			}
		</div>
	`,
})
export class LanguageSelectorComponent {
	protected readonly svc = inject(LocaleService);
	protected readonly open = signal(false);

	protected readonly active = computed(
		() => this.svc.available.find((o) => o.code === this.svc.current()) ?? this.svc.available[0],
	);

	toggle(): void {
		this.open.set(!this.open());
	}

	pick(code: Locale): void {
		this.svc.set(code);
		this.open.set(false);
	}
}
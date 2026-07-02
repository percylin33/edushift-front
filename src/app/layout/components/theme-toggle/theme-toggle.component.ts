import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconComponent, IconName } from '@shared/components';
import { Theme } from '@core/enums';
import { ThemeService } from '@core/services';

interface ThemeOption {
  value: Theme;
  label: string;
  icon: IconName;
  hint: string;
}

/**
 * Theme picker with three explicit options. The trigger button shows the
 * currently effective theme; the dropdown lets the user override it. Clicking
 * the active option clears the override and falls back to tenant default /
 * system preference (see `ThemeService.clearUserPreference`).
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="relative">
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md text-content-muted hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        aria-label="Cambiar tema"
        [attr.title]="triggerLabel()"
        (click)="toggle()"
      >
        <app-icon [name]="triggerIcon()" [size]="18" />
      </button>

      @if (open()) {
        <button
          type="button"
          class="fixed inset-0 z-30"
          aria-hidden="true"
          tabindex="-1"
          (click)="close()"
        ></button>

        <div
          class="absolute right-0 z-40 mt-2 w-48 origin-top-right animate-fade-in rounded-lg border border-border bg-surface-raised p-1 shadow-soft-lg"
          role="menu"
        >
          @for (option of options; track option.value) {
            <button
              type="button"
              role="menuitemradio"
              [attr.aria-checked]="userTheme() === option.value"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-content hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
              (click)="pick(option.value)"
            >
              <app-icon [name]="option.icon" [size]="16" class="text-content-muted" />
              <span class="flex-1">{{ option.label }}</span>
              @if (userTheme() === option.value) {
                <app-icon name="check" [size]="14" class="text-primary-600" />
              }
            </button>
          }

          @if (hasUserPreference()) {
            <div class="my-1 h-px bg-border-subtle"></div>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-content-muted hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
              (click)="reset()"
            >
              <app-icon name="x" [size]="14" />
              Quitar preferencia
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ThemeToggleComponent {
  private readonly themeService = inject(ThemeService);

  readonly options: readonly ThemeOption[] = [
    { value: Theme.Light, label: 'Claro', icon: 'sun', hint: 'Tema claro' },
    { value: Theme.Dark, label: 'Oscuro', icon: 'moon', hint: 'Tema oscuro' },
    { value: Theme.System, label: 'Sistema', icon: 'monitor', hint: 'Sigue al sistema operativo' },
  ];

  readonly userTheme = this.themeService.userTheme;
  readonly hasUserPreference = this.themeService.hasUserPreference;
  readonly isDark = this.themeService.isDark;

  readonly triggerIcon = computed<IconName>(() => (this.isDark() ? 'moon' : 'sun'));
  readonly triggerLabel = computed(() => `Tema actual: ${this.isDark() ? 'oscuro' : 'claro'}`);

  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();

  toggle(): void {
    this._open.update((v) => !v);
  }
  close(): void {
    this._open.set(false);
  }

  pick(theme: Theme): void {
    this.themeService.setTheme(theme);
    this.close();
  }

  reset(): void {
    this.themeService.clearUserPreference();
    this.close();
  }
}

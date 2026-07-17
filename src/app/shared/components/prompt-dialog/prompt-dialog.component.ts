import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon';
import { PromptDialogConfig } from './prompt-dialog.model';

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-sm flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div class="flex items-center gap-3">
            @if (config().icon; as iconName) {
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full"
                [class.bg-danger-50]="config().variant === 'danger'"
                [class.bg-warning-50]="config().variant === 'warning'"
                [class.bg-surface-muted]="!config().variant || config().variant === 'default'"
              >
                <app-icon
                  [name]="iconName"
                  [size]="20"
                  [class.text-danger-600]="config().variant === 'danger'"
                  [class.text-warning-600]="config().variant === 'warning'"
                  [class.text-content]="!config().variant || config().variant === 'default'"
                />
              </div>
            }
            <h2 id="prompt-title" class="card-title">{{ config().title }}</h2>
          </div>
        </header>

        <div class="card-body space-y-3">
          <p class="text-sm text-content-muted">{{ config().message }}</p>
          <label class="block space-y-1">
            @if (config().inputLabel; as label) {
              <span class="text-sm font-medium text-content">{{ label }}</span>
            }
            <input
              #inputEl
              [type]="config().inputType || 'text'"
              [(ngModel)]="value"
              [placeholder]="config().inputPlaceholder || ''"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              (keydown.enter)="confirm()"
            />
          </label>
        </div>

        <footer class="card-footer flex justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="cancel()"
          >
            {{ config().cancelLabel || 'Cancelar' }}
          </button>
          <button
            type="button"
            class="btn btn-sm"
            [class.btn-danger]="config().variant === 'danger'"
            [class.btn-primary]="config().variant !== 'danger'"
            (click)="confirm()"
            [disabled]="!value"
          >
            {{ config().confirmLabel || 'Confirmar' }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class PromptDialogComponent {
  readonly config = signal<PromptDialogConfig>({
    title: '',
    message: '',
  });

  protected value = '';

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  private _resolve: ((value: string | null) => void) | null = null;

  constructor() {
    afterNextRender(() => {
      this.inputEl()?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  protected confirm(): void {
    this._resolve?.(this.value);
    this._resolve = null;
  }

  protected cancel(): void {
    this._resolve?.(null);
    this._resolve = null;
  }

  setResolver(resolve: (value: string | null) => void): void {
    this._resolve = resolve;
  }
}

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center text-primary-600" role="status" aria-live="polite">
      <span
        class="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
        [style.width.px]="size"
        [style.height.px]="size"
      ></span>
      @if (label) {
        <span class="sr-only">{{ label }}</span>
      }
    </span>
  `
})
export class SpinnerComponent {
  @Input() size = 16;
  @Input() label = 'Cargando…';
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TenantAssetsService } from '@core/theming/tenant-assets.service';

export type TenantLogoVariant = 'mark' | 'full';
export type TenantLogoSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Renders the active tenant's logo, automatically picking the right variant
 * for the current theme (light / dark) and the requested slot:
 *
 *   <app-tenant-logo variant="mark" size="md" />   — square icon
 *   <app-tenant-logo variant="full" size="lg" />   — horizontal logo
 *
 * Fallback: when the tenant did not upload a logo we render a brand-gradient
 * chip with the tenant's initial. Both states share the exact same outer
 * dimensions, so layouts never reflow when assets load.
 */
@Component({
  selector: 'app-tenant-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (resolvedUrl(); as url) {
      <img [src]="url" [alt]="alt()" [class]="imgClass()" loading="lazy" decoding="async" />
    } @else {
      <span [class]="chipClass()" [attr.aria-label]="alt()">
        {{ initial() }}
      </span>
    }
  `,
})
export class TenantLogoComponent {
  private readonly assets = inject(TenantAssetsService);

  readonly variant = input<TenantLogoVariant>('mark');
  readonly size = input<TenantLogoSize>('md');

  readonly resolvedUrl = computed(() =>
    this.variant() === 'full' ? this.assets.fullLogoUrl() : this.assets.markUrl(),
  );
  readonly alt = this.assets.alt;
  readonly initial = this.assets.initial;

  /** Image classes — `<img>` keeps its aspect ratio inside the box. */
  readonly imgClass = computed(() => {
    const base = 'block object-contain';
    const dim = this.dimensions();
    return this.variant() === 'mark' ? `${base} ${dim.square} rounded-base` : `${base} ${dim.full}`;
  });

  /** Fallback brand chip classes (mark variant always uses a chip). */
  readonly chipClass = computed(() => {
    const dim = this.dimensions();
    const sizeText = this.textSize();
    return [
      'flex items-center justify-center',
      'rounded-base bg-gradient-brand text-white font-bold shadow-soft-sm',
      this.variant() === 'mark' ? dim.square : dim.fullChip,
      sizeText,
    ].join(' ');
  });

  private dimensions() {
    switch (this.size()) {
      case 'sm':
        return { square: 'h-7 w-7', full: 'h-7 w-auto max-h-7', fullChip: 'h-7 px-2.5' };
      case 'lg':
        return { square: 'h-10 w-10', full: 'h-10 w-auto max-h-10', fullChip: 'h-10 px-3' };
      case 'xl':
        return { square: 'h-12 w-12', full: 'h-12 w-auto max-h-12', fullChip: 'h-12 px-3.5' };
      default:
        return { square: 'h-9 w-9', full: 'h-9 w-auto max-h-9', fullChip: 'h-9 px-3' };
    }
  }

  private textSize(): string {
    switch (this.size()) {
      case 'sm':
        return 'text-xs';
      case 'lg':
        return 'text-base';
      case 'xl':
        return 'text-lg';
      default:
        return 'text-sm';
    }
  }
}

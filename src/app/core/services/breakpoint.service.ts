import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/**
 * Tailwind breakpoint keys. Values match `tailwind.config.js` container.screens
 * exactly so utility classes and runtime checks stay aligned.
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const BREAKPOINTS: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1440,
};

/**
 * Reactive viewport queries via `matchMedia`. Components use this when they
 * need conditional logic (not pure CSS) at a given breakpoint — e.g. lazily
 * mounting a heavy desktop-only widget, swapping a table for a stack of cards,
 * or deciding the initial sidebar state.
 *
 * Each breakpoint listener is registered exactly once and disposed when the
 * service is destroyed (root singleton → app teardown).
 *
 * Usage:
 *   private readonly bp = inject(BreakpointService);
 *   readonly isMobile  = this.bp.below('md');
 *   readonly isDesktop = this.bp.atLeast('lg');
 */
@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly width = signal<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  /** Current Tailwind breakpoint key — largest one whose threshold is met. */
  readonly current = computed<Breakpoint | 'xs'>(() => {
    const w = this.width();
    if (w >= BREAKPOINTS['2xl']) return '2xl';
    if (w >= BREAKPOINTS.xl) return 'xl';
    if (w >= BREAKPOINTS.lg) return 'lg';
    if (w >= BREAKPOINTS.md) return 'md';
    if (w >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
  });

  /** True when the viewport is < `md` (Tailwind's mobile boundary). */
  readonly isMobile = computed(() => this.width() < BREAKPOINTS.md);

  /** True when the viewport is between `md` and `lg`. */
  readonly isTablet = computed(
    () => this.width() >= BREAKPOINTS.md && this.width() < BREAKPOINTS.lg,
  );

  /** True when the viewport is ≥ `lg`. */
  readonly isDesktop = computed(() => this.width() >= BREAKPOINTS.lg);

  private resizeListener: (() => void) | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    this.resizeListener = () => this.width.set(window.innerWidth);
    window.addEventListener('resize', this.resizeListener, { passive: true });
    this.destroyRef.onDestroy(() => {
      if (this.resizeListener) {
        window.removeEventListener('resize', this.resizeListener);
      }
    });
  }

  /** Reactive: viewport ≥ given breakpoint. */
  atLeast(bp: Breakpoint) {
    const min = BREAKPOINTS[bp];
    return computed(() => this.width() >= min);
  }

  /** Reactive: viewport < given breakpoint. */
  below(bp: Breakpoint) {
    const min = BREAKPOINTS[bp];
    return computed(() => this.width() < min);
  }
}

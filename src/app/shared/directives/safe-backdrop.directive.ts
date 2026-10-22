import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/** A backdrop click is intentional only when the entire pointer gesture stays on the backdrop. */
@Directive({ selector: '[appSafeBackdrop]', standalone: true })
export class SafeBackdropDirective {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let start: { id: number; x: number; y: number } | null = null;
    let allowed = false;
    const down = (event: PointerEvent): void => {
      allowed = false;
      start = event.target === host && event.button === 0 && event.isPrimary
        ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    };
    const up = (event: PointerEvent): void => {
      allowed = !!start && start.id === event.pointerId && event.target === host
        && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5;
      start = null;
    };
    const cancel = (): void => { start = null; allowed = false; };
    const click = (event: MouseEvent): void => {
      if (event.target !== host) return;
      if (!allowed || event.button !== 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      allowed = false;
    };
    host.addEventListener('pointerdown', down, true);
    host.addEventListener('pointerup', up, true);
    host.addEventListener('pointercancel', cancel, true);
    host.addEventListener('click', click, true);
    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('pointerdown', down, true);
      host.removeEventListener('pointerup', up, true);
      host.removeEventListener('pointercancel', cancel, true);
      host.removeEventListener('click', click, true);
    });
  }
}

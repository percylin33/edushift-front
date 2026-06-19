import { Injectable } from '@angular/core';

/**
 * Minimal focus-trap helper for modal dialogs.
 *
 * <p>Used by {@code GradeDialogComponent} (FE-7a.2) to keep keyboard
 * focus inside the dialog while it's open. The implementation is
 * intentionally small: on {@link #activate} we snapshot the
 * currently-focused element, focus the first tabbable inside the
 * root, and install a {@code keydown} handler that intercepts
 * {@code Tab} / {@code Shift+Tab} to cycle inside the container. On
 * {@link #deactivate} we restore focus to the snapshot.
 *
 * <p>What this is NOT:
 * <ul>
 *   <li>An ARIA-live announcer (out of scope).</li>
 *   <li>An inert-background manager (we use {@code aria-modal} and a
 *       dim overlay; sibling focus is gated by the keydown handler).</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class FocusTrap {
  private handler: ((event: KeyboardEvent) => void) | null = null;
  private restoreTo: HTMLElement | null = null;

  activate(root: HTMLElement): void {
    this.deactivate();
    this.restoreTo = document.activeElement as HTMLElement | null;

    const focusables = getTabbables(root);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      root.tabIndex = -1;
      root.focus();
    }

    this.handler = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const list = getTabbables(root);
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (current === first || !root.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (current === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', this.handler);
  }

  deactivate(): void {
    if (this.handler) {
      document.removeEventListener('keydown', this.handler);
      this.handler = null;
    }
    if (this.restoreTo) {
      this.restoreTo.focus();
      this.restoreTo = null;
    }
  }
}

/**
 * Returns the elements inside {@code root} that are tabbable in DOM
 * order. We use a pragmatic selector that covers the common
 * interactive elements without pulling in a 30KB utility.
 */
function getTabbables(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && isVisible(el)
  );
}

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent !== null) return true;
  if (el.tagName === 'BODY') return true;
  return getComputedStyle(el).position === 'fixed';
}

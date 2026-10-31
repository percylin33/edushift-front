import { DOCUMENT, DestroyRef, ElementRef, Injectable, afterEveryRender, inject } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';
import { ConfirmDialogService } from '../components/confirm-dialog/confirm-dialog.service';

export interface ProtectedForm {
  snapshot: () => unknown;
  saving?: () => boolean;
  active?: () => boolean;
}

/** Stable snapshots include disabled fields and file identity, without persisting personal data. */
export function formSnapshot(value: unknown): string {
  return (
    JSON.stringify(value, (_key: string, item: unknown) => {
      if (typeof File !== 'undefined' && item instanceof File) {
        return {
          name: item.name,
          size: item.size,
          type: item.type,
          lastModified: item.lastModified,
        };
      }
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        return Object.fromEntries(
          Object.entries(item).sort(([left], [right]) => left.localeCompare(right)),
        );
      }
      return item;
    }) ?? 'null'
  );
}

export class FormProtectionState {
  private baseline: string;
  private completed = false;

  constructor(readonly options: ProtectedForm) {
    this.baseline = formSnapshot(options.snapshot());
  }

  get active(): boolean {
    return this.options.active?.() ?? true;
  }
  get saving(): boolean {
    return this.active && !this.completed && (this.options.saving?.() ?? false);
  }
  get changed(): boolean {
    return this.active && this.baseline !== formSnapshot(this.options.snapshot());
  }

  captureBaseline(): void {
    this.baseline = formSnapshot(this.options.snapshot());
  }
  beginInteraction(): void {
    this.completed = false;
  }
  markSaved(): void {
    this.captureBaseline();
    this.completed = true;
  }
}

@Injectable({ providedIn: 'root' })
export class FormProtectionService {
  private readonly confirm = inject(ConfirmDialogService);
  private readonly forms = new Set<FormProtectionState>();
  private pending: Promise<boolean> | null = null;
  private approvedNavigation: number | undefined;

  get confirming(): boolean {
    return this.pending !== null;
  }

  register(form: FormProtectionState): () => void {
    this.forms.add(form);
    return () => this.forms.delete(form);
  }

  needsUnloadWarning(): boolean {
    return [...this.forms].some((form) => form.saving || form.changed);
  }

  requestClose(form: FormProtectionState, close: () => void): void {
    if (form.saving || this.confirming) return;
    if (!form.changed) {
      close();
      return;
    }
    void this.confirmDiscard().then((discard) => {
      if (discard && form.active && !form.saving && this.forms.has(form)) close();
    });
  }

  requestChange(form: FormProtectionState, change: () => void): void {
    if (form.saving || this.confirming || !form.active || !this.forms.has(form)) return;
    if (!form.changed) {
      change();
      return;
    }
    void this.confirmDiscard().then((discard) => {
      if (discard && form.active && !form.saving && this.forms.has(form)) change();
    });
  }

  async canNavigate(navigationId?: number): Promise<boolean> {
    if ([...this.forms].some((form) => form.saving)) return false;
    if (navigationId !== undefined && this.approvedNavigation === navigationId) return true;
    if (![...this.forms].some((form) => form.changed)) return true;
    const allowed = await this.confirmDiscard();
    if ([...this.forms].some((form) => form.saving)) return false;
    if (allowed) this.approvedNavigation = navigationId;
    return allowed;
  }

  private confirmDiscard(): Promise<boolean> {
    if (this.pending) return this.pending;
    this.pending = this.confirm
      .open({
        title: '¿Descartar los cambios?',
        message: 'Tienes cambios sin guardar. Si sales, se perderán.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        variant: 'danger',
        preferCancel: true,
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }
}

export const pendingChangesGuard: CanDeactivateFn<unknown> = () =>
  inject(FormProtectionService).canNavigate(inject(Router).getCurrentNavigation()?.id);

/** Call from a component field; callbacks are evaluated only after its fields are initialized. */
export function createFormProtection(options: ProtectedForm): {
  requestClose: (close: () => void) => void;
  requestChange: (change: () => void) => void;
  markSaved: () => void;
} {
  const service = inject(FormProtectionService);
  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const document = inject(DOCUMENT);
  const destroy = inject(DestroyRef);
  let state: FormProtectionState | undefined;
  let unregister: (() => void) | undefined;
  let engaged = false;
  const active = (): boolean => (options.active?.() ?? true) && host.isConnected;
  const initialize = (): FormProtectionState => {
    if (!state) {
      state = new FormProtectionState({ ...options, active });
      unregister = service.register(state);
    }
    return state;
  };
  // Initial API loads and default selections remain the baseline until the user interacts.
  const render = afterEveryRender(() => {
    if (!active()) {
      engaged = false;
      return;
    }
    if (!engaged) initialize().captureBaseline();
  });
  const engage = (): void => {
    if (active() && !engaged) {
      initialize().captureBaseline();
      initialize().beginInteraction();
      engaged = true;
    }
  };
  const events = ['pointerdown', 'keydown', 'input', 'change'] as const;
  for (const event of events) host.addEventListener(event, engage, true);
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (state && (state.changed || state.saving)) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  document.defaultView?.addEventListener('beforeunload', beforeUnload);
  destroy.onDestroy(() => {
    render.destroy();
    unregister?.();
    for (const event of events) host.removeEventListener(event, engage, true);
    document.defaultView?.removeEventListener('beforeunload', beforeUnload);
  });
  return {
    requestClose: (close) => {
      if (!active() || service.confirming) return;
      const dialogs = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(
        (dialog) => dialog.getClientRects().length > 0,
      );
      const top = dialogs.at(-1);
      if (top && !host.contains(top)) return;
      service.requestClose(initialize(), close);
    },
    requestChange: (change) => service.requestChange(initialize(), change),
    markSaved: () => {
      initialize().markSaved();
      engaged = false;
    },
  };
}

import { Injectable, inject, signal } from '@angular/core';

import { StorageService } from '@core/services';
import {
  WALKTHROUGH_PROGRESS_STORAGE_KEY,
  WalkthroughProgress,
} from '../models/walkthrough.model';

/**
 * Tracks which steps of which walkthrough feature the user has already
 * ticked off. Persisted to localStorage so the same set of completed
 * checks survives reloads and tab switches.
 *
 * <p>The progress key is {@code `${capabilityId}:${stepId}`} so the
 * same step id can collide only if its parent capability changes — which
 * is a catalog change, not a runtime concern.</p>
 */
@Injectable({ providedIn: 'root' })
export class WalkthroughProgressService {
  private readonly storage = inject(StorageService);

  /** Reactive snapshot of the persisted map; updates on every toggle. */
  readonly progress = signal<WalkthroughProgress>(this.load());

  /** Build the storage key for a step. */
  static key(capabilityId: string, stepId: string): string {
    return `${capabilityId}:${stepId}`;
  }

  isCompleted(capabilityId: string, stepId: string): boolean {
    return !!this.progress().completed[WalkthroughProgressService.key(capabilityId, stepId)];
  }

  toggle(capabilityId: string, stepId: string): boolean {
    const key = WalkthroughProgressService.key(capabilityId, stepId);
    const current = this.progress();
    const next: WalkthroughProgress = {
      completed: { ...current.completed },
    };
    if (next.completed[key]) {
      delete next.completed[key];
    } else {
      next.completed[key] = true;
    }
    this.save(next);
    return !!next.completed[key];
  }

  /** Reset the whole progress map. Backs the "Limpiar progreso" button. */
  resetAll(): void {
    const empty: WalkthroughProgress = { completed: {} };
    this.save(empty);
  }

  /** Reset only the entries for one capability (used when a guide is updated). */
  resetCapability(capabilityId: string): void {
    const current = this.progress();
    const next: WalkthroughProgress = {
      completed: Object.fromEntries(
        Object.entries(current.completed).filter(([k]) => !k.startsWith(`${capabilityId}:`)),
      ),
    };
    this.save(next);
  }

  countCompleted(capabilityId: string): number {
    const prefix = `${capabilityId}:`;
    return Object.keys(this.progress().completed).filter((k) => k.startsWith(prefix)).length;
  }

  totalStepsForFeature(capabilityId: string, totalSteps: number): { done: number; total: number } {
    return { done: this.countCompleted(capabilityId), total: totalSteps };
  }

  private load(): WalkthroughProgress {
    const raw = this.storage.get<WalkthroughProgress>(WALKTHROUGH_PROGRESS_STORAGE_KEY);
    if (raw && typeof raw === 'object' && raw.completed) return raw;
    return { completed: {} };
  }

  private save(next: WalkthroughProgress): void {
    this.storage.set(WALKTHROUGH_PROGRESS_STORAGE_KEY, next);
    this.progress.set(next);
  }
}
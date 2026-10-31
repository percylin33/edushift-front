import { Injectable, inject, signal } from '@angular/core';

import { StorageService } from '@core/services';
import {
  FAMILY_UAT_PROGRESS_STORAGE_KEY,
  FamilyUatProgress,
  FamilyUatRoleScript,
} from './family-uat.model';
import { familyUatStepCount } from './family-uat.catalog';
import type { RoleKey } from '../models/qa.model';

/**
 * Checkbox progress for Family UAT scripts. Keyed as {@code roleKey:stepId}.
 */
@Injectable({ providedIn: 'root' })
export class FamilyUatProgressService {
  private readonly storage = inject(StorageService);

  readonly progress = signal<FamilyUatProgress>(this.load());

  static key(roleKey: RoleKey, stepId: string): string {
    return `${roleKey}:${stepId}`;
  }

  isCompleted(roleKey: RoleKey, stepId: string): boolean {
    return !!this.progress().completed[FamilyUatProgressService.key(roleKey, stepId)];
  }

  toggle(roleKey: RoleKey, stepId: string): boolean {
    const key = FamilyUatProgressService.key(roleKey, stepId);
    const current = this.progress();
    const next: FamilyUatProgress = { completed: { ...current.completed } };
    if (next.completed[key]) {
      delete next.completed[key];
    } else {
      next.completed[key] = true;
    }
    this.save(next);
    return !!next.completed[key];
  }

  countCompleted(roleKey: RoleKey): number {
    const prefix = `${roleKey}:`;
    return Object.keys(this.progress().completed).filter((k) => k.startsWith(prefix)).length;
  }

  summary(script: FamilyUatRoleScript): { done: number; total: number; percent: number } {
    const total = familyUatStepCount(script);
    const done = this.countCompleted(script.roleKey);
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, percent };
  }

  resetRole(roleKey: RoleKey): void {
    const prefix = `${roleKey}:`;
    const current = this.progress();
    const next: FamilyUatProgress = {
      completed: Object.fromEntries(
        Object.entries(current.completed).filter(([k]) => !k.startsWith(prefix)),
      ),
    };
    this.save(next);
  }

  private load(): FamilyUatProgress {
    const raw = this.storage.get<FamilyUatProgress>(FAMILY_UAT_PROGRESS_STORAGE_KEY);
    if (raw && typeof raw === 'object' && raw.completed) return raw;
    return { completed: {} };
  }

  private save(next: FamilyUatProgress): void {
    this.storage.set(FAMILY_UAT_PROGRESS_STORAGE_KEY, next);
    this.progress.set(next);
  }
}

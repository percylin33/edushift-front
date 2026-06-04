import { Injectable } from '@angular/core';

type StorageEngine = 'local' | 'session';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string, engine: StorageEngine = 'local'): T | null {
    try {
      const raw = this.storage(engine).getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T, engine: StorageEngine = 'local'): void {
    try {
      this.storage(engine).setItem(key, JSON.stringify(value));
    } catch {
      /* swallow quota / serialization errors silently for now */
    }
  }

  remove(key: string, engine: StorageEngine = 'local'): void {
    this.storage(engine).removeItem(key);
  }

  clear(engine: StorageEngine = 'local'): void {
    this.storage(engine).clear();
  }

  private storage(engine: StorageEngine): Storage {
    return engine === 'local' ? localStorage : sessionStorage;
  }
}

import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly minLevel = LEVELS[environment.logging.level];

  debug(...args: unknown[]): void {
    if (this.minLevel <= LEVELS.debug) console.debug('[debug]', ...args);
  }

  info(...args: unknown[]): void {
    if (this.minLevel <= LEVELS.info) console.info('[info]', ...args);
  }

  warn(...args: unknown[]): void {
    if (this.minLevel <= LEVELS.warn) console.warn('[warn]', ...args);
  }

  error(...args: unknown[]): void {
    if (this.minLevel <= LEVELS.error) console.error('[error]', ...args);
  }
}

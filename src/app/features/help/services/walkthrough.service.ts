import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, shareReplay, tap } from 'rxjs';

import {
  RoleKey,
  Walkthrough,
  WalkthroughFeature,
  WalkthroughStep,
} from '../models/walkthrough.model';

const ASSET_BASE = 'qa-walkthroughs/';

/**
 * Loads and parses the per-role walkthrough guides shipped as static
 * assets under `public/qa-walkthroughs/<role>.md`.
 *
 * <h3>Why a hand-rolled parser</h3>
 * We only need a small subset of Markdown (headings + tables + fenced
 * code). Pulling in `marked` + `dompurify` for a feature that displays a
 * few hundred lines of documentation per role would be overkill — and
 * would add ~80KB to the bundle for content that already lives on disk.
 * If we ever need full GFM rendering, swap this for `marked` behind the
 * same return shape.
 */
@Injectable({ providedIn: 'root' })
export class WalkthroughService {
  private readonly http = inject(HttpClient);

  private readonly cache = new Map<RoleKey, Observable<Walkthrough>>();

  /** Bumped each time the user toggles a checkbox — components subscribe. */
  readonly progressVersion = signal(0);

  load(roleKey: RoleKey): Observable<Walkthrough> {
    const cached = this.cache.get(roleKey);
    if (cached) return cached;
    const slug = this.slugFor(roleKey);
    const url = `${ASSET_BASE}${slug}.md`;
    const obs = this.http
      .get(url, { responseType: 'text' })
      .pipe(
        map((md) => this.parse(roleKey, slug, md)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.cache.set(roleKey, obs);
    return obs;
  }

  /** Force-refresh — invalidates the in-memory cache. Used after progress reset. */
  invalidate(): void {
    this.cache.clear();
  }

  // ---------------------------------------------------------------------
  // Parser
  // ---------------------------------------------------------------------

  private parse(roleKey: RoleKey, slug: string, md: string): Walkthrough {
    const lines = md.split(/\r?\n/);
    const title = this.extractTitle(lines);
    const intro = this.extractIntro(lines);
    const features = this.extractFeatures(lines);

    return { roleKey, slug, title, intro, features };
  }

  private extractTitle(lines: string[]): string {
    for (const line of lines) {
      const m = /^#\s+(.+)$/.exec(line);
      if (m) return m[1].trim();
    }
    return 'Walkthrough';
  }

  private extractIntro(lines: string[]): string {
    const out: string[] = [];
    let inTitle = false;
    for (const line of lines) {
      if (!inTitle && /^#\s+/.test(line)) {
        inTitle = true;
        continue;
      }
      if (inTitle) {
        if (/^##\s+/.test(line)) break;
        if (line.trim() === '' && out.length > 0 && out[out.length - 1] === '') break;
        out.push(line);
      }
    }
    return out.join('\n').trim();
  }

  private extractFeatures(lines: string[]): WalkthroughFeature[] {
    const features: WalkthroughFeature[] = [];
    let current: WalkthroughFeature | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // New feature block: `## F1. …`
      const featMatch = /^##\s+/.exec(line);
      if (featMatch) {
        if (current) features.push(current);
        current = {
          heading: line.replace(/^##\s+/, '').trim(),
          capabilityId: null,
          steps: [],
          body: '',
        };
        continue;
      }

      if (!current) continue;

      // Capability id: `### Capability: `<id>``
      const capMatch = /^###\s+Capability:\s+`([^`]+)`/.exec(line);
      if (capMatch) {
        current.capabilityId = capMatch[1].trim();
        continue;
      }

      // Steps table — detected by header row starting with `#` and an
      // immediate separator row (|---|---|). The action-column header is
      // accepted in either its technical ("Acción UI") or friendly
      // ("Qué haces") form, so the same parser serves both writing styles.
      if (
        /^\|\s*#\s*\|/.test(line) &&
        /Acción UI|Qué haces|Acción/i.test(line) &&
        /^\|[\s-:|]+\|$/.test(lines[i + 1] ?? '')
      ) {
        const { steps, bodyAfter } = this.parseStepsTable(lines, i, current.capabilityId);
        current.steps = steps;
        current.body = current.body.trim();
        i = bodyAfter - 1;
        continue;
      }

      current.body += line + '\n';
    }

    if (current) features.push(current);
    return features;
  }

  private parseStepsTable(
    lines: string[],
    headerIdx: number,
    capabilityId: string | null,
  ): { steps: WalkthroughStep[]; bodyAfter: number } {
    const steps: WalkthroughStep[] = [];
    let idx = headerIdx + 2; // skip header + separator
    while (idx < lines.length) {
      const line = lines[idx];
      if (!line.startsWith('|')) break;
      const cells = this.splitRow(line);
      if (cells.length < 3) {
        idx++;
        continue;
      }
      const stepIndex = Number.parseInt(cells[0], 10);
      if (!Number.isFinite(stepIndex)) {
        idx++;
        continue;
      }
      /*
       * Two row shapes are accepted:
       *   Friendly (3 cols): [# | Qué haces | Lo que debería pasar]
       *   Technical (7+ cols): [# | Acción | Endpoint | Payload | Éxito | data-testid | Notas]
       * The renderer displays the same fields regardless — the technical
       * shape just has more metadata to surface.
       */
      const step: WalkthroughStep =
        cells.length >= 6
          ? {
              id: `s${stepIndex}`,
              index: stepIndex,
              action: cells[1],
              endpoint: cells[2],
              payload: cells[3],
              successCriterion: cells[4],
              testId: cells[5],
              notes: cells[6] ?? '',
            }
          : {
              id: `s${stepIndex}`,
              index: stepIndex,
              action: cells[1],
              endpoint: '—',
              payload: '—',
              successCriterion: cells[2] ?? '',
              testId: '—',
              notes: '',
            };
      steps.push(step);
      idx++;
    }
    return { steps, bodyAfter: idx };
  }

  private splitRow(line: string): string[] {
    // Strip leading/trailing pipe then split on `|`. Trim each cell.
    const trimmed = line.replace(/^\|/, '').replace(/\|\s*$/, '');
    return trimmed.split('|').map((c) => c.trim());
  }

  private slugFor(roleKey: RoleKey): string {
    return `${roleKey}-walkthrough`;
  }
}
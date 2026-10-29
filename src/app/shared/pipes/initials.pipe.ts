import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'initials', standalone: true })
export class InitialsPipe implements PipeTransform {
  transform(value: string | null | undefined, max = 2): string {
    if (!value) return '';
    return value
      .split(/\s+/)
      .filter((part) => Boolean(part) && !SPANISH_NAME_PARTICLES.has(part.toLocaleLowerCase()))
      .slice(0, max)
      .map((p) => p.charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase())
      .join('');
  }
}

const SPANISH_NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

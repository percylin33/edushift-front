import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'initials', standalone: true })
export class InitialsPipe implements PipeTransform {
  transform(value: string | null | undefined, max = 2): string {
    if (!value) return '';
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, max)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }
}

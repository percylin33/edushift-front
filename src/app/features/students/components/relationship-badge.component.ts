import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RelationshipType } from '@core/enums';

/**
 * Visual chip for {@link RelationshipType}. Mirrors the design-system
 * {@code badge-*} palette used across the app.
 *
 * <p>Mother / father get a deliberately neutral primary tone — they
 * are the most common relationships and should not visually scream
 * for attention. Grandparent and Guardian use {@code badge-info}
 * (close family / legal guardian); {@code Other} stays neutral.
 */
@Component({
  selector: 'app-relationship-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="badgeClass()">{{ label() }}</span>`,
})
export class RelationshipBadgeComponent {
  readonly relationship = input.required<RelationshipType>();

  readonly label = computed(
    () => RelationshipBadgeComponent.LABELS[this.relationship()] ?? this.relationship(),
  );
  readonly badgeClass = computed(
    () => `badge ${RelationshipBadgeComponent.TIER[this.relationship()] ?? 'badge-neutral'}`,
  );

  private static readonly LABELS: Readonly<Record<RelationshipType, string>> = {
    [RelationshipType.Father]: 'Padre',
    [RelationshipType.Mother]: 'Madre',
    [RelationshipType.Grandparent]: 'Abuelo/a',
    [RelationshipType.Guardian]: 'Tutor legal',
    [RelationshipType.Other]: 'Otro',
  };

  private static readonly TIER: Readonly<Record<RelationshipType, string>> = {
    [RelationshipType.Father]: 'badge-primary',
    [RelationshipType.Mother]: 'badge-primary',
    [RelationshipType.Grandparent]: 'badge-info',
    [RelationshipType.Guardian]: 'badge-info',
    [RelationshipType.Other]: 'badge-neutral',
  };
}

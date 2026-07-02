import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RelationshipBadgeComponent } from './relationship-badge.component';
import { RelationshipType } from '@core/enums';

describe('RelationshipBadgeComponent', () => {
  let fixture: ComponentFixture<RelationshipBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RelationshipBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RelationshipBadgeComponent);
  });

  it('muestra Padre para Father', () => {
    fixture.componentRef.setInput('relationship', RelationshipType.Father);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Padre');
  });

  it('muestra Tutor legal para Guardian', () => {
    fixture.componentRef.setInput('relationship', RelationshipType.Guardian);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tutor legal');
  });

  it('aplica badge-primary para Father', () => {
    fixture.componentRef.setInput('relationship', RelationshipType.Father);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-primary');
  });
});

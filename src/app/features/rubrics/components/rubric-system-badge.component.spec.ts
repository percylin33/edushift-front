import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RubricSystemBadgeComponent } from './rubric-system-badge.component';

describe('RubricSystemBadgeComponent', () => {
  let component: RubricSystemBadgeComponent;
  let fixture: ComponentFixture<RubricSystemBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RubricSystemBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RubricSystemBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  describe('isFork', () => {
    it('retorna false si es system', () => {
      fixture.componentRef.setInput('isSystem', true);
      fixture.componentRef.setInput('parentPublicUuid', undefined);
      fixture.detectChanges();
      expect(component.isFork()).toBeFalse();
    });

    it('retorna false si no tiene parent', () => {
      fixture.componentRef.setInput('isSystem', false);
      fixture.componentRef.setInput('parentPublicUuid', undefined);
      fixture.detectChanges();
      expect(component.isFork()).toBeFalse();
    });

    it('retorna true si no es system y tiene parent', () => {
      fixture.componentRef.setInput('isSystem', false);
      fixture.componentRef.setInput('parentPublicUuid', 'parent-uuid');
      fixture.detectChanges();
      expect(component.isFork()).toBeTrue();
    });
  });
});

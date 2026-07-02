import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InvitationStatusBadgeComponent } from './invitation-status-badge.component';
import { InvitationStatus } from '@core/enums';

describe('InvitationStatusBadgeComponent', () => {
  let fixture: ComponentFixture<InvitationStatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvitationStatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(InvitationStatusBadgeComponent);
  });

  it('muestra Pendiente para Pending', () => {
    fixture.componentRef.setInput('status', InvitationStatus.Pending);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pendiente');
  });

  it('aplica badge-success para Accepted', () => {
    fixture.componentRef.setInput('status', InvitationStatus.Accepted);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-success');
  });
});

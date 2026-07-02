import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserStatusBadgeComponent } from './user-status-badge.component';
import { UserStatus } from '@core/enums';

describe('UserStatusBadgeComponent', () => {
  let fixture: ComponentFixture<UserStatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserStatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UserStatusBadgeComponent);
  });

  it('muestra Activo para Active', () => {
    fixture.componentRef.setInput('status', UserStatus.Active);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Activo');
  });

  it('aplica badge-success para Active', () => {
    fixture.componentRef.setInput('status', UserStatus.Active);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-success');
  });

  it('aplica badge-danger para Locked', () => {
    fixture.componentRef.setInput('status', UserStatus.Locked);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-danger');
  });
});

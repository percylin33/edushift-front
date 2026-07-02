import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserRoleBadgeComponent } from './user-role-badge.component';
import { UserRole } from '@core/enums';

describe('UserRoleBadgeComponent', () => {
  let component: UserRoleBadgeComponent;
  let fixture: ComponentFixture<UserRoleBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserRoleBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserRoleBadgeComponent);
    component = fixture.componentInstance;
  });

  it('muestra label Administrador para TenantAdmin', () => {
    fixture.componentRef.setInput('role', UserRole.TenantAdmin);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Administrador');
  });

  it('muestra label Profesor para Teacher', () => {
    fixture.componentRef.setInput('role', UserRole.Teacher);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Profesor');
  });

  it('aplica badge-primary para TenantAdmin', () => {
    fixture.componentRef.setInput('role', UserRole.TenantAdmin);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-primary');
  });

  it('aplica badge-danger para SuperAdmin', () => {
    fixture.componentRef.setInput('role', UserRole.SuperAdmin);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-danger');
  });

  it('fallback para rol desconocido', () => {
    fixture.componentRef.setInput('role', 'UNKNOWN' as any);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('UNKNOWN');
    expect(fixture.nativeElement.querySelector('span').className).toContain('badge-neutral');
  });
});

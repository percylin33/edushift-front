import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthLayoutComponent } from './auth-layout.component';
import { provideRouter } from '@angular/router';
import { TenantService } from '@core/services';

describe('AuthLayoutComponent', () => {
  let component: AuthLayoutComponent;
  let fixture: ComponentFixture<AuthLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [], { tenant: () => null }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('appName está definido', () => {
    expect(component.appName).toBeDefined();
  });

  it('year es el año actual', () => {
    expect(component.year).toBe(new Date().getFullYear());
  });

  it('tenantName devuelve Workspace cuando no hay tenant', () => {
    expect(component.tenantName()).toBe('Workspace');
  });

  it('tenantName devuelve el nombre del tenant cuando existe', () => {
    const tenant = TestBed.inject(TenantService);
    (tenant.tenant as unknown as jasmine.Spy).and.returnValue({ name: 'Mi Escuela' });
    expect(component.tenantName()).toBe('Mi Escuela');
  });
});

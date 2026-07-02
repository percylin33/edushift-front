import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarComponent } from './sidebar.component';
import { LayoutService, NavigationService } from '../../services';
import { TenantService } from '@core/services';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        {
          provide: LayoutService,
          useValue: jasmine.createSpyObj(
            'LayoutService',
            ['toggleSidebarCollapsed', 'closeSidebar', 'openSidebar'],
            { sidebarCollapsed: () => false, sidebarOpen: () => false },
          ),
        },
        {
          provide: NavigationService,
          useValue: jasmine.createSpyObj('NavigationService', [], { groups: () => [] }),
        },
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [], { tenant: () => null }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el nombre de la aplicación', () => {
    expect(component.appName).toBeDefined();
  });

  it('enlace al dashboard es /dashboard', () => {
    expect(component.dashboardLink).toBe('/dashboard');
  });

  it('toggleCollapsed llama a layout.toggleSidebarCollapsed', () => {
    const layout = TestBed.inject(LayoutService);
    component.toggleCollapsed();
    expect(layout.toggleSidebarCollapsed).toHaveBeenCalled();
  });

  it('closeMobile llama a layout.closeSidebar', () => {
    const layout = TestBed.inject(LayoutService);
    component.closeMobile();
    expect(layout.closeSidebar).toHaveBeenCalled();
  });

  it('width es 256 cuando no está colapsado', () => {
    const layout = TestBed.inject(LayoutService);
    (layout.sidebarCollapsed as unknown as jasmine.Spy).and.returnValue(false);
    expect(component.width()).toBe(256);
  });

  it('width es 72 cuando está colapsado', () => {
    const layout = TestBed.inject(LayoutService);
    (layout.sidebarCollapsed as unknown as jasmine.Spy).and.returnValue(true);
    expect(component.width()).toBe(72);
  });

  it('tenantName usa el tenant real cuando existe', () => {
    const tenant = TestBed.inject(TenantService);
    (tenant.tenant as unknown as jasmine.Spy).and.returnValue({ name: 'Mi Escuela' });
    expect(component.tenantName()).toBe('Mi Escuela');
  });
});

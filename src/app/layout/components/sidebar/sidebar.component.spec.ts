import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SidebarComponent } from './sidebar.component';
import { LayoutService, NavigationService } from '../../services';
import { TenantService } from '@core/services';
import { provideRouter } from '@angular/router';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let layoutSpy: {
    toggleSidebarCollapsed: jasmine.Spy;
    closeSidebar: jasmine.Spy;
    openSidebar: jasmine.Spy;
    sidebarCollapsed: ReturnType<typeof signal<boolean>>;
    sidebarOpen: ReturnType<typeof signal<boolean>>;
  };
  let tenantSignal: ReturnType<typeof signal<{ name: string } | null>>;

  beforeEach(async () => {
    layoutSpy = {
      toggleSidebarCollapsed: jasmine.createSpy('toggleSidebarCollapsed'),
      closeSidebar: jasmine.createSpy('closeSidebar'),
      openSidebar: jasmine.createSpy('openSidebar'),
      sidebarCollapsed: signal(false),
      sidebarOpen: signal(false),
    };
    tenantSignal = signal<{ name: string } | null>(null);
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: LayoutService, useValue: layoutSpy },
        {
          provide: NavigationService,
          useValue: jasmine.createSpyObj('NavigationService', [], { groups: () => [] }),
        },
        {
          provide: TenantService,
          useValue: { tenant: tenantSignal },
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
    component.toggleCollapsed();
    expect(layoutSpy.toggleSidebarCollapsed).toHaveBeenCalled();
  });

  it('closeMobile llama a layout.closeSidebar', () => {
    component.closeMobile();
    expect(layoutSpy.closeSidebar).toHaveBeenCalled();
  });

  it('width es 256 cuando no está colapsado', () => {
    layoutSpy.sidebarCollapsed.set(false);
    expect(component.width()).toBe(256);
  });

  it('width es 72 cuando está colapsado', () => {
    layoutSpy.sidebarCollapsed.set(true);
    expect(component.width()).toBe(72);
  });

  it('tenantName usa el tenant real cuando existe', () => {
    tenantSignal.set({ name: 'Mi Escuela' });
    expect(component.tenantName()).toBe('Mi Escuela');
  });
});

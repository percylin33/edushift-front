import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout.service';
import { StorageService } from '@core/services';

describe('LayoutService', () => {
  let service: LayoutService;
  let storageSpy: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    storageSpy = jasmine.createSpyObj('StorageService', ['get', 'set', 'remove']);
    storageSpy.get.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [LayoutService, { provide: StorageService, useValue: storageSpy }],
    });
    service = TestBed.inject(LayoutService);
  });

  it('inicia con sidebarCollapsed en false', () => {
    expect(service.sidebarCollapsed()).toBeFalse();
  });

  it('inicia con sidebarOpen en false', () => {
    expect(service.sidebarOpen()).toBeFalse();
  });

  it('toggleSidebarCollapsed invierte el estado y persiste', () => {
    service.toggleSidebarCollapsed();
    expect(service.sidebarCollapsed()).toBeTrue();
    expect(storageSpy.set).toHaveBeenCalled();
  });

  it('setSidebarCollapsed establece el valor y persiste', () => {
    service.setSidebarCollapsed(true);
    expect(service.sidebarCollapsed()).toBeTrue();
    expect(storageSpy.set).toHaveBeenCalled();
  });

  it('openSidebar establece sidebarOpen en true', () => {
    service.openSidebar();
    expect(service.sidebarOpen()).toBeTrue();
  });

  it('closeSidebar establece sidebarOpen en false', () => {
    service.openSidebar();
    service.closeSidebar();
    expect(service.sidebarOpen()).toBeFalse();
  });

  it('toggleSidebar invierte sidebarOpen', () => {
    service.toggleSidebar();
    expect(service.sidebarOpen()).toBeTrue();
    service.toggleSidebar();
    expect(service.sidebarOpen()).toBeFalse();
  });
});

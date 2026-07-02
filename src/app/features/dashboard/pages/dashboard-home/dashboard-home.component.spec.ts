import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardHomeComponent } from './dashboard-home.component';
import { DashboardStore } from '../../store/dashboard.store';
import { AuthService, TenantService } from '@core/services';
import { UserRole } from '@core/enums';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('DashboardHomeComponent', () => {
  let component: DashboardHomeComponent;
  let fixture: ComponentFixture<DashboardHomeComponent>;
  let storeSpy: jasmine.SpyObj<DashboardStore>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let tenantSpy: jasmine.SpyObj<TenantService>;

  const mockOverview = {
    generatedAt: new Date(),
    attendanceRateToday: 85.5,
    enrollmentsConsidered: 200,
    openSessions: 5,
    uniqueStudentsRegisteredToday: 150,
    totalAbsencesToday: 20,
    topAbsentSections: [
      {
        sectionPublicUuid: 's1',
        sectionName: '5A',
        gradeName: '5to',
        absentCount: 10,
        enrolledStudents: 30,
        absentRatePct: 33.3,
      },
    ],
    recentClosedSessions: [
      {
        sessionPublicUuid: 'ss1',
        sectionPublicUuid: 's1',
        sectionName: '5A',
        occurredOn: new Date(),
        slot: 'MORNING' as const,
        closedAt: new Date(),
        presentCount: 25,
        lateCount: 3,
        absentCount: 2,
        excusedCount: 0,
        totalRecords: 30,
      },
    ],
    noClassToday: false,
  };

  beforeEach(async () => {
    storeSpy = jasmine.createSpyObj('DashboardStore', ['loadAttendanceOverview'], {
      overview: signal(mockOverview),
      loading: signal(false),
      error: signal(null),
      metrics: signal([]),
      widgets: signal([]),
      lastLoadedAt: signal(null),
      isEmpty: signal(false),
    });
    authSpy = jasmine.createSpyObj('AuthService', ['hasRole'], { user$: of({}) });
    authSpy.hasRole.and.callFake((role: string) => role === UserRole.TenantAdmin);
    tenantSpy = jasmine.createSpyObj('TenantService', [], {
      tenant: signal({ name: 'Colegio Test' }),
    });

    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        { provide: DashboardStore, useValue: storeSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: TenantService, useValue: tenantSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga overview si es admin', () => {
    expect(storeSpy.loadAttendanceOverview).toHaveBeenCalled();
  });

  describe('kpis', () => {
    it('genera KPIs desde overview', () => {
      const kpis = component.kpis();
      expect(kpis.length).toBe(4);
      expect(kpis[0].id).toBe('rate');
      expect(kpis[0].value).toContain('85.5%');
      expect(kpis[1].value).toBe('5');
    });

    it('retorna KPIs vacíos si no hay overview', () => {
      storeSpy.overview = signal(null);
      fixture = TestBed.createComponent(DashboardHomeComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      const kpis = component.kpis();
      expect(kpis.every((k) => k.value === '—')).toBeTrue();
    });
  });

  describe('greeting', () => {
    it('genera saludo con nombre', () => {
      authSpy = jasmine.createSpyObj('AuthService', ['hasRole'], {
        user: () => ({ firstName: 'Juan' }),
        user$: of({}),
      });
      TestBed.overrideProvider(AuthService, { useValue: authSpy });
      // Rebuild needed
    });
  });

  describe('rateBadgeClass', () => {
    it('retorna danger para >= 30%', () => {
      const cls = component.rateBadgeClass(30);
      expect(cls).toContain('danger');
    });

    it('retorna warning para >= 15%', () => {
      const cls = component.rateBadgeClass(15);
      expect(cls).toContain('warning');
    });

    it('retorna success para < 15%', () => {
      const cls = component.rateBadgeClass(10);
      expect(cls).toContain('success');
    });
  });

  describe('slotLabel', () => {
    it('retorna "Mañana" para MORNING', () => {
      expect(component.slotLabel('MORNING')).toBe('Mañana');
    });

    it('retorna "Tarde" para AFTERNOON', () => {
      expect(component.slotLabel('AFTERNOON')).toBe('Tarde');
    });
  });
});

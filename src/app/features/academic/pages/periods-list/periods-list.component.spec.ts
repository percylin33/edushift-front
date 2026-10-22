import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NotificationService } from '@core/services';
import { ConfirmDialogService } from '@shared/components';
import { AcademicStore } from '../../store';
import { AcademicYearRow, AcademicYearStatus } from '../../models';
import { PeriodsListComponent } from './periods-list.component';

describe('Periods year selection', () => {
  let rows: AcademicYearRow[];
  let query: Record<string, string>;
  const years = signal<AcademicYearRow[]>([]);
  const currentActive = computed(() => years().find(year => year.status === AcademicYearStatus.Active) ?? null);
  const active: AcademicYearRow = { publicUuid: 'current-year', name: '2026', status: AcademicYearStatus.Active,
    startDate: new Date(2026, 2, 1), endDate: new Date(2026, 11, 20) };
  const planned: AcademicYearRow = { ...active, publicUuid: 'planned-year', name: '2027', status: AcademicYearStatus.Planning };
  let loadYears: jasmine.Spy;
  let filterPeriods: jasmine.Spy;
  let navigate: jasmine.Spy;
  beforeEach(async () => {
    rows = [planned, active]; query = {}; years.set([]);
    loadYears = jasmine.createSpy().and.callFake(async () => { years.set(rows); });
    filterPeriods = jasmine.createSpy().and.resolveTo();
    navigate = jasmine.createSpy().and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [PeriodsListComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return convertToParamMap(query); } } } },
        { provide: Router, useValue: { navigate } },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: AcademicStore, useValue: { years, currentActive, periods: signal([]),
          loadingPeriods: signal(false), savingPeriod: signal(false), hasPeriods: signal(false),
          error: signal(null), bulkProgress: signal(null), applyYearFilters: loadYears, applyPeriodFilters: filterPeriods } },
      ],
    }).compileComponents();
  });
  async function render(): Promise<ComponentFixture<PeriodsListComponent>> {
    const fixture = TestBed.createComponent(PeriodsListComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    return fixture;
  }
  it('selects the current tenant year by name and loads its periods by default', async () => {
    const fixture = await render();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#filter-year');
    expect(select.selectedOptions[0].textContent).toContain('2026');
    expect(filterPeriods).toHaveBeenCalledWith({ academicYearPublicUuid: 'current-year', periodType: undefined });
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { yearId: 'current-year', periodType: null } }));
  });
  it('honors a valid explicit year from a shared URL', async () => {
    query = { yearId: 'planned-year' };
    const fixture = await render();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#filter-year');
    expect(select.selectedOptions[0].textContent).toContain('2027');
    expect(filterPeriods).toHaveBeenCalledWith({ academicYearPublicUuid: 'planned-year', periodType: undefined });
  });
  it('replaces an unknown or foreign year with the current tenant year', async () => {
    query = { yearId: 'another-school-year' };
    const fixture = await render();
    expect(fixture.componentInstance['yearFilter']()).toBe('current-year');
    expect(filterPeriods).toHaveBeenCalledWith({ academicYearPublicUuid: 'current-year', periodType: undefined });
  });
  it('refreshes a previously filtered year catalog before choosing the current year', async () => {
    years.set([planned]);
    const fixture = await render();
    expect(loadYears).toHaveBeenCalledWith({});
    expect(fixture.componentInstance['yearFilter']()).toBe('current-year');
  });
  it('does not silently choose a planning year when there is no current year', async () => {
    rows = [planned];
    const fixture = await render();
    expect(fixture.componentInstance['yearFilter']()).toBeNull();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#filter-year');
    expect(select.selectedOptions[0].textContent).toContain('Sin año académico vigente');
    expect(fixture.componentInstance['canCreate']()).toBeFalse();
  });
});

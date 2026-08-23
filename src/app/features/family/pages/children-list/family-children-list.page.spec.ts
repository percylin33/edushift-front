import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FamilyApiService, FamilyChildSummary } from '../../services/family-api.service';
import { FamilyChildrenListPageComponent } from './family-children-list.page';

describe('FamilyChildrenListPageComponent', () => {
  let fixture: ComponentFixture<FamilyChildrenListPageComponent>;
  let component: FamilyChildrenListPageComponent;
  let api: jasmine.SpyObj<FamilyApiService>;

  const child: FamilyChildSummary = {
    publicUuid: 'child-1',
    firstName: 'Ana',
    lastName: 'Torres',
    fullName: 'Ana Torres',
    enrollmentStatus: 'ENROLLED',
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<FamilyApiService>('FamilyApiService', ['listChildren']);
    TestBed.configureTestingModule({
      imports: [FamilyChildrenListPageComponent],
      providers: [provideRouter([]), { provide: FamilyApiService, useValue: api }],
    });
    fixture = TestBed.createComponent(FamilyChildrenListPageComponent);
    component = fixture.componentInstance;
  });

  it('loads linked children and clears loading state', () => {
    api.listChildren.and.returnValue(of({ success: true, data: [child] }));

    component.ngOnInit();

    expect(component.children()).toEqual([child]);
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.initials(child)).toBe('AT');
  });

  it('shows an actionable error and supports retry', () => {
    api.listChildren.and.returnValues(
      throwError(() => new Error('network')),
      of({ success: true, data: [child] }),
    );

    component.load();
    expect(component.error()).toContain('No se pudo cargar');
    expect(component.loading()).toBeFalse();

    component.load();
    expect(component.children()).toEqual([child]);
    expect(component.error()).toBeNull();
  });

  it('renders the empty state without leaking other students', () => {
    api.listChildren.and.returnValue(of({ success: true, data: [] }));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aún no hay hijos vinculados');
    expect(fixture.nativeElement.querySelectorAll('a[href^="/family/children/"]').length).toBe(0);
  });
});

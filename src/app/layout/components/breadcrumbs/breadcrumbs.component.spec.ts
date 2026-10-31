import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { BreadcrumbService } from '../../services';

describe('BreadcrumbsComponent', () => {
  let component: BreadcrumbsComponent;
  let fixture: ComponentFixture<BreadcrumbsComponent>;
  let breadcrumbsSignal: ReturnType<typeof signal>;

  beforeEach(async () => {
    breadcrumbsSignal = signal([]);
    await TestBed.configureTestingModule({
      imports: [BreadcrumbsComponent],
      providers: [
        {
          provide: BreadcrumbService,
          useValue: { breadcrumbs: breadcrumbsSignal },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BreadcrumbsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('crumbs es un array vacío por defecto', () => {
    expect(component.crumbs()).toEqual([]);
  });

  it('crumbs refleja las migas del servicio', () => {
    const mockCrumbs = [{ label: 'Inicio', url: '/' }];
    breadcrumbsSignal.set(mockCrumbs);
    expect(component.crumbs()).toEqual(mockCrumbs);
  });
});

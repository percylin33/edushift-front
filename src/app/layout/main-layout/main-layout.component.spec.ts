import { Component, ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';

@Component({ standalone: true, template: 'docentes' })
class TeachersStubComponent {}

describe('MainLayoutComponent', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([
          {
            path: 'teachers',
            loadComponent: () =>
              new Promise((resolve) => setTimeout(() => resolve(TeachersStubComponent), 20)),
          },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('muestra Cargando en cuanto empieza a bajar un módulo', fakeAsync(() => {
    const router = TestBed.inject(Router);
    void router.navigateByUrl('/teachers');
    tick(0);
    fixture.detectChanges();

    expect(component.routeLoading()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Cargando…');

    tick(20);
    fixture.detectChanges();
    expect(component.routeLoading()).toBeFalse();
  }));
});

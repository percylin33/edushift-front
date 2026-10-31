import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { LmsShellComponent } from './lms-shell.component';

describe('LmsShellComponent', () => {
  let component: LmsShellComponent;
  let fixture: ComponentFixture<LmsShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LmsShellComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LmsShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('contiene router-outlet', () => {
    const outlet = fixture.nativeElement.querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });
});

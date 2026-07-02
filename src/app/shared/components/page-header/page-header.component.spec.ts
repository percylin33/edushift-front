import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let component: PageHeaderComponent;
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Test Page');
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('title es el input proporcionado', () => {
    expect(component.title()).toBe('Test Page');
  });

  it('subtitle es null por defecto', () => {
    expect(component.subtitle()).toBeNull();
  });

  it('eyebrow es null por defecto', () => {
    expect(component.eyebrow()).toBeNull();
  });

  it('renderiza el título en el DOM', () => {
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1.textContent).toContain('Test Page');
  });

  it('muestra subtitle cuando se proporciona', () => {
    fixture.componentRef.setInput('subtitle', 'Subtítulo');
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('p.text-content-muted');
    expect(p.textContent).toContain('Subtítulo');
  });

  it('muestra eyebrow cuando se proporciona', () => {
    fixture.componentRef.setInput('eyebrow', 'Sección');
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('p.text-2xs');
    expect(p.textContent).toContain('Sección');
  });
});

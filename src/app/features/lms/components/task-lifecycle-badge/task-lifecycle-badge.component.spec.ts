import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskLifecycleBadgeComponent } from './task-lifecycle-badge.component';
import { TaskLifecycle } from '../../models';

describe('TaskLifecycleBadgeComponent', () => {
  let component: TaskLifecycleBadgeComponent;
  let fixture: ComponentFixture<TaskLifecycleBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskLifecycleBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskLifecycleBadgeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('lifecycle', TaskLifecycle.Draft);
    fixture.detectChanges();
  });

  it('se crea con lifecycle Draft', () => {
    expect(component).toBeTruthy();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toContain('Borrador');
  });

  it('muestra "Publicada" para Published', () => {
    fixture.componentRef.setInput('lifecycle', TaskLifecycle.Published);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toContain('Publicada');
  });

  it('muestra "Cerrada" para Closed', () => {
    fixture.componentRef.setInput('lifecycle', TaskLifecycle.Closed);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toContain('Cerrada');
  });

  it('aria-label refleja el estado', () => {
    fixture.componentRef.setInput('lifecycle', TaskLifecycle.Published);
    fixture.detectChanges();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.getAttribute('aria-label')).toContain('Publicada');
  });
});

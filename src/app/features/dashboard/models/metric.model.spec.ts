import { Metric, DashboardWidget } from './metric.model';

describe('Metric', () => {
  it('crea métrica con valor numérico', () => {
    const m: Metric = { key: 'students', label: 'Estudiantes', value: 150 };
    expect(m.value).toBe(150);
  });

  it('crea métrica con valor string', () => {
    const m: Metric = { key: 'rate', label: 'Tasa', value: '95%' };
    expect(m.value).toBe('95%');
  });

  it('crea métrica con tendencia', () => {
    const m: Metric = {
      key: 'attendance',
      label: 'Asistencia',
      value: 85,
      trend: 'up',
      deltaPct: 5,
    };
    expect(m.trend).toBe('up');
    expect(m.deltaPct).toBe(5);
  });
});

describe('DashboardWidget', () => {
  it('crea widget de tipo metric', () => {
    const w: DashboardWidget = {
      id: 'w1',
      type: 'metric',
      title: 'Widget',
      payload: { value: 42 },
    };
    expect(w.type).toBe('metric');
  });

  it('crea widget de tipo chart', () => {
    const w: DashboardWidget = {
      id: 'w2',
      type: 'chart',
      title: 'Gráfico',
      payload: { labels: [] },
    };
    expect(w.type).toBe('chart');
  });
});

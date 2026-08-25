import {
  DASHBOARD_LIST_WIDGET_LIMIT,
  isActiveWorkStatus,
  selectActiveRequestsForDashboard,
  selectActiveTasksForDashboard,
} from '../dashboardUtils';

describe('isActiveWorkStatus', () => {
  it('includes not started and in progress only', () => {
    expect(isActiveWorkStatus('not started')).toBe(true);
    expect(isActiveWorkStatus('in progress')).toBe(true);
    expect(isActiveWorkStatus('completed')).toBe(false);
    expect(isActiveWorkStatus('cancelled')).toBe(false);
  });
});

describe('selectActiveRequestsForDashboard', () => {
  const requests = [
    { id: '1', status: 'completed', created_at: '2026-08-20T10:00:00.000Z', title: 'done' },
    { id: '2', status: 'not started', created_at: '2026-08-21T10:00:00.000Z', title: 'new' },
    { id: '3', status: 'in progress', created_at: '2026-08-19T10:00:00.000Z', title: 'wip' },
    { id: '4', status: 'cancelled', created_at: '2026-08-22T10:00:00.000Z', title: 'cancel' },
    { id: '5', status: 'not started', created_at: '2026-08-18T10:00:00.000Z', title: 'older' },
  ];

  it('excludes completed and cancelled, sorts newest first', () => {
    const visible = selectActiveRequestsForDashboard(requests);
    expect(visible.map((r) => r.id)).toEqual(['2', '3', '5']);
  });

  it('caps at DASHBOARD_LIST_WIDGET_LIMIT', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      status: 'not started' as const,
      created_at: new Date(Date.UTC(2026, 7, i + 1)).toISOString(),
      title: `r${i}`,
    }));
    const visible = selectActiveRequestsForDashboard(many);
    expect(visible).toHaveLength(DASHBOARD_LIST_WIDGET_LIMIT);
    expect(visible[0].id).toBe('11');
  });
});

describe('selectActiveTasksForDashboard', () => {
  const tasks = [
    {
      id: '1',
      status: 'completed',
      createdAt: new Date('2026-08-20T10:00:00.000Z'),
      title: 'done',
    },
    {
      id: '2',
      status: 'not started',
      createdAt: new Date('2026-08-21T10:00:00.000Z'),
      title: 'new',
    },
    {
      id: '3',
      status: 'in progress',
      createdAt: new Date('2026-08-19T10:00:00.000Z'),
      title: 'wip',
    },
    {
      id: '4',
      status: 'cancelled',
      createdAt: new Date('2026-08-22T10:00:00.000Z'),
      title: 'cancel',
    },
  ];

  it('excludes completed and cancelled, sorts newest first', () => {
    const visible = selectActiveTasksForDashboard(tasks);
    expect(visible.map((t) => t.id)).toEqual(['2', '3']);
  });
});

import { TASKS_SETTINGS_KEY } from '../taskColumnCount';

describe('taskColumnCount', () => {
  it('exports the tasks settings key', () => {
    expect(TASKS_SETTINGS_KEY).toBe('tasks');
  });
});

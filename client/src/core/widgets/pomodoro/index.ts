import { registerWidget } from '../registry';

import { PomodoroTimer } from './PomodoroTimer';

registerWidget({
  id: 'pomodoro',
  label: 'Pomodoro',
  order: 10,
  component: PomodoroTimer,
  defaultEnabled: true,
  scope: 'topbar',
});

export { PomodoroTimer } from './PomodoroTimer';
export { usePomodoroTimer } from './usePomodoroTimer';
export * from './pomodoroSettings';

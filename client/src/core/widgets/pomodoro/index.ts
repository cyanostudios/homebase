import { PomodoroTimer } from '@/core/ui/pomodoro/PomodoroTimer';

import { registerWidget } from '../registry';

registerWidget({
  id: 'pomodoro',
  label: 'Pomodoro',
  order: 10,
  component: PomodoroTimer,
  defaultEnabled: true,
  scope: 'topbar',
});

import { registerWidget } from '../registry';

import { PomodoroTimer } from '@/core/ui/pomodoro/PomodoroTimer';

registerWidget({
  id: 'pomodoro',
  label: 'Pomodoro',
  order: 10,
  component: PomodoroTimer,
  defaultEnabled: true,
  scope: 'topbar',
});

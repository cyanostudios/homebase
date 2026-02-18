import { registerWidget } from '../registry';

import { ClockDisplay } from '@/core/ui/clock/ClockDisplay';

registerWidget({
  id: 'clock',
  label: 'Clock',
  order: 20,
  component: ClockDisplay,
  defaultEnabled: true,
  scope: 'topbar',
});

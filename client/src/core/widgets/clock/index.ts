import { ClockDisplay } from '@/core/ui/clock/ClockDisplay';

import { registerWidget } from '../registry';

registerWidget({
  id: 'clock',
  label: 'Clock',
  order: 20,
  component: ClockDisplay,
  defaultEnabled: true,
  scope: 'topbar',
});

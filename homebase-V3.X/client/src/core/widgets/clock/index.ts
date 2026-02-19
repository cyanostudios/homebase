import { registerWidget } from '../registry';

import { ClockDisplay } from './ClockDisplay';

registerWidget({
  id: 'clock',
  label: 'Clock',
  order: 20,
  component: ClockDisplay,
  defaultEnabled: true,
  scope: 'topbar',
});

export { ClockDisplay } from './ClockDisplay';
export { useClock } from './useClock';
export * from './clockSettings';

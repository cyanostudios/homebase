import { registerWidget } from '../registry';

import { TimeTrackingWidget } from './TimeTrackingWidget';

registerWidget({
  id: 'time-tracking',
  label: 'Time tracking',
  order: 15,
  component: TimeTrackingWidget,
  defaultEnabled: true,
  scope: 'topbar',
});

export { TimeTrackingWidget } from './TimeTrackingWidget';

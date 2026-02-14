/**
 * TopBar widgets: load clock, pomodoro, and time-tracking so they register, then export registry access.
 */
import './clock';
import './pomodoro';
import './time-tracking';

export { getTopBarWidgets, registerWidget } from './registry';
export type { TopBarWidgetProps, WidgetDescriptor, WidgetScope } from './registry';

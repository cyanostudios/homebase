/**
 * TopBar widget registry.
 * Widgets are rendered in the TopBar in order; each can be expanded/collapsed.
 */

import type React from 'react';

export type WidgetScope = 'topbar';

export interface WidgetDescriptor {
  id: string;
  label: string;
  order: number;
  component: React.ComponentType<TopBarWidgetProps>;
  defaultEnabled: boolean;
  scope: WidgetScope;
}

export interface TopBarWidgetProps {
  compact?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

const registry: WidgetDescriptor[] = [];

export function registerWidget(widget: WidgetDescriptor): void {
  const existing = registry.findIndex((w) => w.id === widget.id);
  if (existing >= 0) {
    registry[existing] = widget;
  } else {
    registry.push(widget);
  }
}

export function getTopBarWidgets(): WidgetDescriptor[] {
  return [...registry].sort((a, b) => a.order - b.order);
}

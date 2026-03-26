import type { ExportFormatConfig } from '@/core/utils/exportUtils';

import type { Slot } from '../types/slots';

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE');
  } catch {
    return '';
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  try {
    const d = new Date(value);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export function getSlotExportBaseFilename(slot: Slot): string {
  const name = (slot.name || slot.location || `slot-${slot.id}`)
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  return name;
}

function slotToTxtContent(slot: Slot): string {
  const lines: string[] = [
    slot.name ? `Name: ${slot.name}` : `Slot: SLT-${slot.id}`,
    slot.location ? `Location: ${slot.location}` : '',
    slot.address ? `Address: ${slot.address}` : '',
    `Time: ${formatDateTime(slot.slot_time)}`,
    slot.slot_end ? `End: ${formatDateTime(slot.slot_end)}` : '',
    `Capacity: ${slot.capacity}`,
    slot.category ? `Category: ${slot.category}` : '',
    `Visible: ${slot.visible ? 'Yes' : 'No'}`,
    `Notifications: ${slot.notifications_enabled ? 'Yes' : 'No'}`,
    slot.description ? `\nDescription:\n${slot.description}` : '',
    `\nCreated: ${formatDate(slot.created_at)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return lines;
}

function slotToCsvRow(slot: Slot): Record<string, unknown> {
  return {
    id: slot.id,
    name: slot.name ?? '',
    location: slot.location ?? '',
    address: slot.address ?? '',
    slot_time: slot.slot_time,
    slot_end: slot.slot_end ?? '',
    capacity: slot.capacity,
    category: slot.category ?? '',
    visible: slot.visible,
    notifications_enabled: slot.notifications_enabled,
    description: (slot.description ?? '').slice(0, 500),
    created_at: slot.created_at,
  };
}

function slotToPdfRow(slot: Slot): Record<string, unknown> {
  return {
    name: slot.name || `SLT-${slot.id}`,
    location: slot.location ?? '',
    slot_time: formatDateTime(slot.slot_time),
    capacity: slot.capacity,
    category: slot.category ?? '',
    created_at: formatDate(slot.created_at),
  };
}

export const slotExportConfig: ExportFormatConfig = {
  txt: {
    getContent: slotToTxtContent,
    getFilename: (slot: Slot) => `${getSlotExportBaseFilename(slot)}.txt`,
    baseFilename: `slots-export-${new Date().toISOString().split('T')[0]}`,
  },
  csv: {
    headers: [
      'id',
      'name',
      'location',
      'address',
      'slot_time',
      'slot_end',
      'capacity',
      'category',
      'visible',
      'notifications_enabled',
      'description',
      'created_at',
    ],
    mapItemToRow: slotToCsvRow,
  },
  pdf: {
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'location', label: 'Location' },
      { key: 'slot_time', label: 'Time' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'category', label: 'Category' },
      { key: 'created_at', label: 'Created' },
    ],
    mapItemToRow: slotToPdfRow,
    title: 'Slots Export',
  },
};

import type { TFunction } from 'i18next';

import type { ActivityLogEntry } from '@/core/api/activityLogApi';

/** Resolve who performed the action (email preferred). */
export function getActivityActorLabel(entry: ActivityLogEntry): string | null {
  if (entry.actorLabel) return entry.actorLabel;
  if (entry.metadata?.actor_email) return entry.metadata.actor_email;
  if (entry.metadata?.actor_name) return entry.metadata.actor_name;
  if (entry.metadata?.actor_user_id != null) {
    return `#${entry.metadata.actor_user_id}`;
  }
  return null;
}

/** Human-readable detail lines for what happened. */
export function getActivityDetailLines(
  entry: ActivityLogEntry,
  t: TFunction,
  options?: { hideEntityName?: boolean },
): string[] {
  const lines: string[] = [];
  const { action, entityName, metadata } = entry;
  const hideEntityName = options?.hideEntityName ?? false;

  if (metadata?.changeSummary) {
    lines.push(
      t('activityLog.changedFields', {
        fields: metadata.changeSummary,
        defaultValue: 'Changed: {{fields}}',
      }),
    );
  }

  if (!hideEntityName && entityName && action === 'create' && !metadata?.changeSummary) {
    lines.push(
      t('activityLog.createdEntity', {
        name: entityName,
        defaultValue: 'Created {{name}}',
      }),
    );
  }

  if (!hideEntityName && entityName && action === 'delete') {
    lines.push(
      t('activityLog.deletedEntity', {
        name: entityName,
        defaultValue: 'Deleted {{name}}',
      }),
    );
  }

  if (action === 'export' && metadata?.exportFormat) {
    lines.push(
      t('activityLog.exportFormat', {
        format: metadata.exportFormat,
        defaultValue: 'Format: {{format}}',
      }),
    );
  }

  if (action === 'settings' && entityName && !metadata?.changeSummary) {
    lines.push(
      t('activityLog.settingsCategory', {
        category: entityName,
        defaultValue: 'Category: {{category}}',
      }),
    );
  }

  if (metadata?.count != null && Number(metadata.count) > 1) {
    lines.push(
      t('activityLog.bulkCount', {
        count: metadata.count,
        defaultValue: '{{count}} items',
      }),
    );
  }

  if (
    !hideEntityName &&
    entityName &&
    action === 'update' &&
    !metadata?.changeSummary &&
    lines.length === 0
  ) {
    lines.push(entityName);
  }

  return lines;
}

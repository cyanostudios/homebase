// templates/plugin-frontend-template/components/YourItemView.tsx
import React from 'react';

import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';

interface YourItemViewProps {
  item: any; // Template: keep generic; your real plugin should type this
}

export const YourItemView: React.FC<YourItemViewProps> = ({ item }) => {
  if (!item) {
    return null;
  }

  // Normalize dates
  const created = item.createdAt ? new Date(item.createdAt) : null;
  const updated = item.updatedAt ? new Date(item.updatedAt) : null;

  // Show common fields if present
  const title: string = item.title ?? '';
  const description: string = item.description ?? '';

  // Derive “other fields” (anything not id/title/description/createdAt/updatedAt)
  const OMIT = new Set(['id', 'title', 'description', 'createdAt', 'updatedAt', '_raw']);
  const otherEntries = Object.entries(item).filter(([k]) => !OMIT.has(k));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-2">
          Summary
        </Heading>
        {title ? (
          <div className="text-sm text-gray-900">{title}</div>
        ) : (
          <Text variant="caption" className="text-gray-500">
            No title
          </Text>
        )}
        {description && (
          <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{description}</div>
        )}
      </Card>

      {/* Other Fields (auto) */}
      {otherEntries.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Details
          </Heading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otherEntries.map(([key, value]) => (
              <div key={key}>
                <div className="text-xs text-gray-500">{key}</div>
                <div className="text-sm text-gray-900">
                  {Array.isArray(value) || (value && typeof value === 'object')
                    ? JSON.stringify(value)
                    : String(value ?? '—')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Metadata
        </Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{String(item.id ?? '—')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">
              {created ? created.toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">
              {updated ? updated.toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

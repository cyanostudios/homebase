// templates/plugin-frontend-template/components/YourItemView.tsx
// Uses DetailSection and standard metadata grid (see UI_AND_UX_STANDARDS_V3.md §3)
import React from 'react';
import { DetailSection } from '@/core/ui/DetailSection';

interface YourItemViewProps {
  item: any;
}

export const YourItemView: React.FC<YourItemViewProps> = ({ item }) => {
  if (!item) return null;

  const created = item.createdAt ? new Date(item.createdAt) : null;
  const updated = item.updatedAt ? new Date(item.updatedAt) : null;
  const title: string = item.title ?? '';
  const description: string = item.description ?? '';

  const OMIT = new Set(['id', 'title', 'description', 'createdAt', 'updatedAt', '_raw']);
  const otherEntries = Object.entries(item).filter(([k]) => !OMIT.has(k));

  return (
    <div className="space-y-4">
      <DetailSection title="Summary">
        {title ? (
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</div>
        ) : (
          <div className="text-sm text-muted-foreground">No title</div>
        )}
        {description && (
          <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {description}
          </div>
        )}
      </DetailSection>

      {otherEntries.length > 0 && (
        <DetailSection title="Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otherEntries.map(([key, value]) => (
              <div key={key}>
                <div className="text-xs text-muted-foreground">{key}</div>
                <div className="text-sm font-medium">
                  {Array.isArray(value) || (value && typeof value === 'object')
                    ? JSON.stringify(value)
                    : String(value ?? '—')}
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title="Information">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">System ID</div>
            <div className="text-sm font-medium font-mono">{String(item.id ?? '—')}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created</div>
            <div className="text-sm font-medium">
              {created ? created.toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last Updated</div>
            <div className="text-sm font-medium">
              {updated ? updated.toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </DetailSection>
    </div>
  );
};

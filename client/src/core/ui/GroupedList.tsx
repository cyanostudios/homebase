import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface GroupConfig<T> {
  // Function to get the group key for an item
  getGroupKey: (item: T) => string;
  // Function to get the display label for a group
  getGroupLabel: (groupKey: string, items: T[]) => string;
  // Optional: function to get the order/priority of groups (lower = first)
  getGroupOrder?: (groupKey: string) => number;
  // Optional: default open state for groups
  defaultOpen?: boolean;
}

interface GroupedListProps<T> {
  items: T[];
  groupConfig: GroupConfig<T> | null; // null = no grouping
  renderItem: (item: T, idx: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function GroupedList<T>({
  items,
  groupConfig,
  renderItem,
  emptyMessage = 'No items found.',
  className = '',
}: GroupedListProps<T>) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Group items if groupConfig is provided
  const grouped = React.useMemo(() => {
    if (!groupConfig) {
      return null;
    }

    const groups = new Map<string, T[]>();
    items.forEach((item) => {
      const groupKey = groupConfig.getGroupKey(item);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });

    // Convert to array and sort by order if provided
    const groupArray = Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: groupConfig.getGroupLabel(key, items),
      items,
      order: groupConfig.getGroupOrder ? groupConfig.getGroupOrder(key) : 0,
    }));

    if (groupConfig.getGroupOrder) {
      groupArray.sort((a, b) => a.order - b.order);
    }

    return groupArray;
  }, [items, groupConfig]);

  // Initialize open groups
  useEffect(() => {
    if (grouped && groupConfig?.defaultOpen !== false) {
      setOpenGroups(new Set(grouped.map((g) => g.key)));
    }
  }, [grouped, groupConfig]);

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className={`p-6 text-center text-muted-foreground ${className}`}>{emptyMessage}</div>
    );
  }

  // If no grouping, render flat list
  if (!grouped) {
    return (
      <div className={`divide-y divide-border ${className}`}>
        {items.map((item, idx) => {
          const key =
            typeof item === 'object' && item !== null && 'id' in item
              ? String((item as any).id)
              : `item-${idx}`;
          return <div key={key}>{renderItem(item, idx)}</div>;
        })}
      </div>
    );
  }

  // Render grouped list
  return (
    <div className={`divide-y divide-border ${className}`}>
      {grouped.map((group) => {
        const isOpen = openGroups.has(group.key);
        return (
          <div key={group.key}>
            {/* Group Header */}
            <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
              <CollapsibleTrigger asChild>
                <div className="px-4 py-2 bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">{group.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{group.items.length}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="divide-y divide-border">
                  {group.items.map((item, idx) => {
                    const key =
                      typeof item === 'object' && item !== null && 'id' in item
                        ? String((item as any).id)
                        : `item-${idx}`;
                    return <div key={key}>{renderItem(item, idx)}</div>;
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}

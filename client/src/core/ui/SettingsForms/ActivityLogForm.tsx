// client/src/core/ui/SettingsForms/ActivityLogForm.tsx
// Activity log form component

import { ChevronDown } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { activityLogApi, ActivityLogEntry, ActivityLogParams } from '@/core/api/activityLogApi';
import { useApp } from '@/core/api/AppContext';
import { notesApi } from '@/plugins/notes/api/notesApi';

interface ActivityLogFormProps {
  onCancel: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  update: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  delete: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  export: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  settings: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
};

const formatValue = (val: string) => val.charAt(0).toUpperCase() + val.slice(1);

export function ActivityLogForm({ onCancel: _onCancel }: ActivityLogFormProps) {
  const { user } = useApp();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<ActivityLogParams>({
    limit: 50,
    offset: 0,
  });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Only load logs if offset is 0 (initial load or filter change)
    // Load more is handled separately
    if ((filters.offset || 0) === 0) {
      loadLogs(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.entityType, filters.action, filters.startDate, filters.endDate]);

  const loadLogs = async (append = false) => {
    setIsLoading(true);
    try {
      const response = await activityLogApi.getActivityLogs(filters);
      if (append) {
        setLogs((prev) => [...prev, ...response.logs]);
      } else {
        setLogs(response.logs);
      }
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ActivityLogParams, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      offset: 0, // Reset offset when filters change
    }));
  };

  const handleLoadMore = async () => {
    const newOffset = (filters.offset || 0) + (filters.limit || 50);
    setIsLoading(true);
    try {
      const response = await activityLogApi.getActivityLogs({
        ...filters,
        offset: newOffset,
      });
      setLogs((prev) => [...prev, ...response.logs]);
      setTotal(response.total);
      setFilters((prev) => ({
        ...prev,
        offset: newOffset,
      }));
    } catch (error) {
      console.error('Failed to load more activity logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRowExpansion = (id: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleRestore = async (log: ActivityLogEntry) => {
    if (!confirm(`Are you sure you want to restore this ${log.entityType}?`)) {
      return;
    }

    try {
      if (log.entityType === 'note' && (log.metadata.backup || log.metadata.backups)) {
        if (!user?.plugins?.includes('notes')) {
          alert('Restore for notes requires the notes plugin to be enabled for your account.');
          return;
        }
        const backups = log.metadata.backups || [log.metadata.backup];
        for (const backup of backups) {
          // Remove ID and timestamps from backup to create a new record
          const { id, createdAt, updatedAt, ...rest } = backup;
          await notesApi.createNote(rest);
        }
        alert('Restoration successful!');
        loadLogs(false);
      } else {
        alert(`Restore for ${log.entityType} is not handled yet.`);
      }
    } catch (error) {
      console.error('Restore failed:', error);
      alert('Failed to restore. Check console for details.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasMore = (filters.offset || 0) + (filters.limit || 50) < total;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="shadow-none p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Entity Type</label>
            <NativeSelect
              value={filters.entityType || ''}
              onChange={(e) => handleFilterChange('entityType', e.target.value || undefined)}
              className="w-full"
            >
              <option value="">All Types</option>
              {/* Common hints, but display in table is generic */}
              <option value="contact">Contact</option>
              <option value="note">Note</option>
              <option value="task">Task</option>
              <option value="estimate">Estimate</option>
              <option value="invoice">Invoice</option>
              <option value="file">File</option>
              <option value="settings">Settings</option>
            </NativeSelect>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Action</label>
            <NativeSelect
              value={filters.action || ''}
              onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
              className="w-full"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="export">Export</option>
              <option value="settings">Settings</option>
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ limit: 50, offset: 0 });
              }}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Activity Log Table */}
      <Card className="shadow-none">
        {isLoading && logs.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">Loading activity logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No activity logged yet. Your actions will appear here.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity Name</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const isExpanded = expandedRows.has(log.id);
                  return (
                    <React.Fragment key={log.id}>
                      <TableRow>
                        <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                        <TableCell>
                          <Badge className={ACTION_COLORS[log.action] || ''}>
                            {formatValue(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatValue(log.entityType)}</TableCell>
                        <TableCell className="text-sm">
                          {log.entityName || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleRowExpansion(log.id)}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <div className="space-y-2 p-2">
                              {log.entityId && (
                                <div className="text-xs">
                                  <span className="font-medium">Entity ID:</span> {log.entityId}
                                </div>
                              )}
                              {log.metadata.ip && (
                                <div className="text-xs">
                                  <span className="font-medium">IP:</span> {log.metadata.ip}
                                </div>
                              )}
                              {log.metadata.userAgent && (
                                <div className="text-xs">
                                  <span className="font-medium">User Agent:</span>{' '}
                                  <span className="text-muted-foreground">
                                    {log.metadata.userAgent}
                                  </span>
                                </div>
                              )}
                              {log.metadata.exportFormat && (
                                <div className="text-xs">
                                  <span className="font-medium">Export Format:</span>{' '}
                                  {log.metadata.exportFormat}
                                </div>
                              )}
                              {(log.metadata.backup || log.metadata.backups) &&
                                log.action === 'delete' && (
                                  <div className="pt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                      onClick={() => handleRestore(log)}
                                    >
                                      Restore {formatValue(log.entityType)}
                                    </Button>
                                  </div>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="p-4 text-center border-t">
                <Button variant="outline" onClick={handleLoadMore} disabled={isLoading}>
                  {isLoading ? 'Loading...' : `Load More (${total - logs.length} remaining)`}
                </Button>
              </div>
            )}
            <div className="p-4 text-center border-t text-sm text-muted-foreground">
              Showing {logs.length} of {total} activities
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

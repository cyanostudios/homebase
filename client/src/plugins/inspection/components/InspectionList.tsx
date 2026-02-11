import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useInspections } from '../hooks/useInspections';
import { inspectionApi } from '../api/inspectionApi';
import { format } from 'date-fns';

export const InspectionList: React.FC = () => {
  const { inspectionProjects, projectsLoading, openInspectionForEdit, openInspectionPanel, loadProjects } = useInspections();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInspectionProjectIds, setSelectedInspectionProjectIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return inspectionProjects;
    return inspectionProjects.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(needle) ||
        (p.description || '').toLowerCase().includes(needle)
    );
  }, [inspectionProjects, searchTerm]);

  const toggleInspectionSelection = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInspectionProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllInspections = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedInspectionProjectIds(new Set(filtered.map((p) => String(p.id))));
    } else {
      setSelectedInspectionProjectIds(new Set());
    }
  }, [filtered]);

  const handleBulkDeleteInspections = useCallback(async () => {
    if (selectedInspectionProjectIds.size === 0) return;
    const ids = Array.from(selectedInspectionProjectIds);
    if (!confirm(`Ta bort ${ids.length} besiktningsprojekt? Detta kan inte ångras.`)) return;
    setBulkDeleteError(null);
    setBulkDeleting(true);
    try {
      await inspectionApi.deleteInspectionProjectsBulk(ids);
      setSelectedInspectionProjectIds(new Set());
      await loadProjects();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kunde inte ta bort projekten.';
      setBulkDeleteError(message);
      console.error('Bulk delete inspection projects failed:', err);
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedInspectionProjectIds, loadProjects]);

  const allSelected = filtered.length > 0 && selectedInspectionProjectIds.size === filtered.length;

  return (
    <div className="flex flex-col gap-4 p-4">
      {bulkDeleteError && (
        <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
          {bulkDeleteError}
        </div>
      )}
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Sök projekt..."
        rightActions={
          selectedInspectionProjectIds.size > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBulkDeleteInspections}
              disabled={bulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {bulkDeleting ? 'Tar bort…' : `Ta bort valda (${selectedInspectionProjectIds.size})`}
            </Button>
          ) : undefined
        }
      />

      {projectsLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-blue-600" />
          <span>Loading…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
          <p className="mb-4">
            {searchTerm
              ? 'Inga projekt matchar sökningen'
              : 'Inga besiktningsprojekt ännu. Skapa ett nytt projekt för att börja.'}
          </p>
          {!searchTerm && (
            <Button onClick={() => openInspectionPanel(null)} icon={Plus}>
              Skapa projekt
            </Button>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Välj alla"
                  checked={allSelected}
                  onChange={toggleAllInspections}
                />
              </TableHead>
              <TableHead>Namn</TableHead>
              <TableHead>Beskrivning</TableHead>
              <TableHead>Filer</TableHead>
              <TableHead>Skapad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => openInspectionForEdit(project)}
              >
                <TableCell onClick={(e) => toggleInspectionSelection(String(project.id), e)}>
                  <input
                    type="checkbox"
                    aria-label={`Välj ${project.name || 'projekt'}`}
                    checked={selectedInspectionProjectIds.has(String(project.id))}
                    onChange={() => {}}
                  />
                </TableCell>
                <TableCell className="font-medium">{project.name || '—'}</TableCell>
                <TableCell className="max-w-[280px] truncate">
                  {project.description || '—'}
                </TableCell>
                <TableCell>{project.fileCount ?? (project.files || []).length}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {project.createdAt
                    ? format(new Date(project.createdAt), 'yyyy-MM-dd')
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

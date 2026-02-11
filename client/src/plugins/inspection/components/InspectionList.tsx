import { ClipboardList, Plus } from 'lucide-react';
import React, { useState, useMemo } from 'react';

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
import { format } from 'date-fns';

export const InspectionList: React.FC = () => {
  const { inspectionProjects, projectsLoading, openInspectionForEdit, openInspectionPanel } = useInspections();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return inspectionProjects;
    return inspectionProjects.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(needle) ||
        (p.description || '').toLowerCase().includes(needle)
    );
  }, [inspectionProjects, searchTerm]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Sök projekt..."
        rightActions={<></>}
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

import { File, Mail, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useInspections } from '../hooks/useInspections';
import { inspectionApi } from '../api/inspectionApi';
import { FilePicker } from './FilePicker';
import { SendModal } from './SendModal';
import type { InspectionProject } from '../types/inspection';

interface InspectionViewProps {
  inspectionProject?: InspectionProject;
  inspection?: InspectionProject;
  item?: InspectionProject;
}

export const InspectionView: React.FC<InspectionViewProps> = (props) => {
  const inspectionProject = props.inspectionProject ?? props.inspection ?? props.item;
  if (!inspectionProject) return null;

  const { loadProjects } = useInspections();
  const [project, setProject] = useState<InspectionProject>(inspectionProject);

  // Load full project with files when opening
  React.useEffect(() => {
    const load = async () => {
      try {
        const p = await inspectionApi.getProject(inspectionProject.id);
        setProject(p);
      } catch (e) {
        console.error('Failed to load project:', e);
      }
    };
    load();
  }, [inspectionProject.id]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  const refresh = async () => {
    try {
      const p = await inspectionApi.getProject(project.id);
      setProject(p);
      await loadProjects();
    } catch (e) {
      console.error('Failed to refresh:', e);
    }
  };

  const handleAddFiles = async (fileIds: string[]) => {
    try {
      await inspectionApi.addFiles(project.id, fileIds);
      await refresh();
      setShowFilePicker(false);
    } catch (e) {
      console.error('Failed to add files:', e);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    try {
      await inspectionApi.removeFile(project.id, fileId);
      await refresh();
    } catch (e) {
      console.error('Failed to remove file:', e);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-medium text-sm text-muted-foreground">Beskrivning</h3>
        <p className="mt-1 whitespace-pre-wrap">{project.description || '—'}</p>
      </div>
      <div>
        <h3 className="font-medium text-sm text-muted-foreground">Admin-kommentarer</h3>
        <p className="mt-1 whitespace-pre-wrap">{project.adminNotes || '—'}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Bifogade filer</Label>
          <Button variant="outline" size="sm" onClick={() => setShowFilePicker(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Lägg till fil
          </Button>
        </div>
        <Card className="p-3">
          {!project.files?.length ? (
            <p className="text-sm text-muted-foreground">Inga filer bifogade</p>
          ) : (
            <ul className="space-y-2">
              {project.files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <File className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{f.name || 'Namnlös'}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => handleRemoveFile(f.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Button className="w-full" onClick={() => setShowSendModal(true)}>
        <Mail className="h-4 w-4 mr-2" />
        Skicka till hantverkare
      </Button>

      {showFilePicker && (
        <div className="border rounded-lg p-4 bg-background">
          <FilePicker
            selectedIds={(project.files || []).map((f) => f.id)}
            onSelect={handleAddFiles}
            onClose={() => setShowFilePicker(false)}
          />
        </div>
      )}

      {showSendModal && (
        <SendModal
          project={project}
          onClose={() => setShowSendModal(false)}
          onSent={refresh}
        />
      )}
    </div>
  );
}

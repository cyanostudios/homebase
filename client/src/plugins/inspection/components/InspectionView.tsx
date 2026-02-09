import React, { useState, useEffect, useCallback, useRef } from 'react';
import { File, Mail, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { filesApi } from '@/plugins/files/api/filesApi';
import { useInspections } from '../hooks/useInspections';
import { inspectionApi } from '../api/inspectionApi';
import { FilePicker } from './FilePicker';
import { SendModal } from './SendModal';
import type { InspectionProject, InspectionFile } from '../types/inspection';

interface InspectionViewProps {
  inspectionProject?: InspectionProject | null;
  inspection?: InspectionProject | null;
  item?: InspectionProject | null;
  onSave?: (data: any) => Promise<boolean>;
  onCancel?: () => void;
}

export const InspectionView: React.FC<InspectionViewProps> = (props) => {
  const projectFromProps = props.inspectionProject ?? props.inspection ?? props.item;
  const { onSave, onCancel } = props;

  const {
    currentInspectionProject,
    closeInspectionPanel,
    loadProjects,
    saveInspectionAndClose,
    validationErrors,
    clearValidationErrors,
  } = useInspections();

  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } = useGlobalNavigationGuard();

  const isCreate = !projectFromProps?.id;
  const projectId = projectFromProps?.id ?? currentInspectionProject?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [projectFiles, setProjectFiles] = useState<InspectionFile[]>([]);
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([]);
  const [filesList, setFilesList] = useState<{ id: string; name?: string }[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);

  const lastLoadedProjectIdRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    const formKey = `inspection-view-${projectId || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, projectId, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  useEffect(() => {
    if (projectFromProps) {
      setName(projectFromProps.name || '');
      setDescription(projectFromProps.description || '');
      setAdminNotes(projectFromProps.adminNotes || '');
      setProjectFiles(projectFromProps.files || []);
      setPendingFileIds([]);
      setIsDirty(false);
    } else {
      setName(new Date().toISOString().slice(0, 10));
      setDescription('');
      setAdminNotes('');
      setProjectFiles([]);
      setPendingFileIds([]);
      setIsDirty(false);
    }

    lastLoadedProjectIdRef.current = null;
    setFilesLoading(false);
  }, [projectFromProps?.id]);

  useEffect(() => {
    if (isCreate || !projectId) return;

    if (lastLoadedProjectIdRef.current === String(projectId)) return;
    lastLoadedProjectIdRef.current = String(projectId);

    const seq = ++loadSeqRef.current;
    setFilesLoading(true);

    inspectionApi
      .getProject(projectId)
      .then((p) => {
        if (!p) return;
        if (seq !== loadSeqRef.current) return;

        setProjectFiles(p.files || []);
        setName(p.name || '');
        setDescription(p.description || '');
        setAdminNotes(p.adminNotes || '');
      })
      .catch(() => {})
      .finally(() => {
        if (seq === loadSeqRef.current) setFilesLoading(false);
      });
  }, [isCreate, projectId]);

  useEffect(() => {
    if (!isCreate) return;
    if (!showFilePicker) return;
    if (filesList.length > 0) return;

    filesApi
      .getItems()
      .then((items) => setFilesList(items || []))
      .catch(() => {});
  }, [isCreate, showFilePicker, filesList.length]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    clearValidationErrors();
    setSaving(true);

    try {
      const payload: any = { name, description, adminNotes };
      if (isCreate) payload.pendingFileIds = pendingFileIds;

      const ok = onSave ? await onSave(payload) : await saveInspectionAndClose(payload);

      if (ok) setIsDirty(false);
      if (!ok) setSaving(false);
    } catch {
      setSaving(false);
    }
  }, [
    saving,
    clearValidationErrors,
    name,
    description,
    adminNotes,
    isCreate,
    pendingFileIds,
    onSave,
    saveInspectionAndClose,
  ]);

  const handleCancel = useCallback(() => {
    if (onCancel) onCancel();
    else closeInspectionPanel();
  }, [onCancel, closeInspectionPanel]);

  useEffect(() => {
    const onSubmit = () => handleSave();
    const onCancelEv = () => handleCancel();

    window.addEventListener('submitInspectionForm', onSubmit);
    window.addEventListener('cancelInspectionForm', onCancelEv);

    return () => {
      window.removeEventListener('submitInspectionForm', onSubmit);
      window.removeEventListener('cancelInspectionForm', onCancelEv);
    };
  }, [handleSave, handleCancel]);

  const handleSetFiles = useCallback(
    async (fileIds: string[]) => {
      if (!projectId) return;

      try {
        const p = await inspectionApi.setFiles(projectId, fileIds);

        setProjectFiles(p?.files || []);
        setName(p?.name || '');
        setDescription(p?.description || '');
        setAdminNotes(p?.adminNotes || '');
        setShowFilePicker(false);
      } catch (e) {
        console.error('Failed to set files:', e);
      }
    },
    [projectId]
  );

  const handleRemoveFile = useCallback(
    async (fileId: string) => {
      if (!projectId) return;

      try {
        const p = await inspectionApi.removeFile(projectId, fileId);
        setProjectFiles(p?.files || []);
      } catch (e) {
        console.error('Failed to remove file:', e);
      }
    },
    [projectId]
  );

  const currentProject = projectFromProps ?? currentInspectionProject;

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4 min-w-0">
          <div>
            <Label htmlFor="inspection-name">Namn</Label>
            <Input
              id="inspection-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              placeholder="T.ex. 2025-01-31"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="inspection-description">Beskrivning</Label>
            <Textarea
              id="inspection-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              placeholder="Vad ska besiktigas?"
              rows={5}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="inspection-adminNotes">Admin-kommentarer</Label>
            <Textarea
              id="inspection-adminNotes"
              value={adminNotes}
              onChange={(e) => {
                setAdminNotes(e.target.value);
                markDirty();
              }}
              placeholder="Egna anteckningar..."
              rows={3}
              className="mt-1"
            />
          </div>

          {!isCreate && currentProject && (
            <Button type="button" variant="default" className="w-full" onClick={() => setShowSendModal(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Skicka till hantverkare
            </Button>
          )}

          {validationErrors.map((e) => (
            <div key={e.field} className="text-sm text-destructive">
              {e.message}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex flex-col gap-3">
          {showFilePicker && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <FilePicker
                selectedIds={isCreate ? pendingFileIds : projectFiles.map((f) => f.id)}
                onSelect={
                  isCreate
                    ? (ids) => {
                        setPendingFileIds(ids);
                        setShowFilePicker(false);
                        markDirty();
                      }
                    : (ids) => {
                        setShowFilePicker(false);
                        setFilesLoading(true);
                        handleSetFiles(ids).finally(() => setFilesLoading(false));
                      }
                }
                onClose={() => setShowFilePicker(false)}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Bifogade filer</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowFilePicker(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Lägg till fil
              </Button>
            </div>

            <Card className="p-3">
              {isCreate ? (
                !pendingFileIds.length ? (
                  <p className="text-sm text-muted-foreground">Inga filer valda</p>
                ) : (
                  <ul className="space-y-2">
                    {pendingFileIds.map((id) => (
                      <li key={id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <File className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {filesList.find((f) => String(f.id) === id)?.name || id}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={() => {
                            setPendingFileIds((prev) => prev.filter((x) => x !== id));
                            markDirty();
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )
              ) : filesLoading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-blue-600" />
                  <span>Loading…</span>
                </div>
              ) : !projectFiles.length ? (
                <p className="text-sm text-muted-foreground">Inga filer bifogade</p>
              ) : (
                <ul className="space-y-2">
                  {projectFiles.map((f) => (
                    <li key={f.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{f.name || 'Namnlös'}</span>
                      </div>
                      <Button
                        type="button"
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
        </div>
      </div>

      {showSendModal && currentProject && (
        <SendModal
          project={{ ...currentProject, files: projectFiles }}
          onClose={() => setShowSendModal(false)}
          onSent={async () => {
            await loadProjects();
          }}
        />
      )}
    </div>
  );
};

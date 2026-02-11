import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, File, Mail, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { filesApi } from '@/plugins/files/api/filesApi';
import { useInspections } from '../hooks/useInspections';
import { inspectionApi, type SendHistoryEntry } from '../api/inspectionApi';
import { FilePicker } from './FilePicker';
import { ListPicker } from './ListPicker';
import { SendModal } from './SendModal';
import type { InspectionProject, InspectionFile, InspectionFileList } from '../types/inspection';

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
    saveInspectionAndStay,
    setPanelMode,
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
  const [projectFileLists, setProjectFileLists] = useState<InspectionFileList[]>([]);
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([]);
  const [pendingListIds, setPendingListIds] = useState<string[]>([]);
  const [pendingLists, setPendingLists] = useState<{ id: string; name: string }[]>([]);
  const [filesList, setFilesList] = useState<{ id: string; name?: string }[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedListIds, setExpandedListIds] = useState<Set<string>>(new Set());
  const [pendingListFilesCache, setPendingListFilesCache] = useState<Record<string, { id: string; name?: string }[]>>({});
  const [fileIdToName, setFileIdToName] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [sendHistory, setSendHistory] = useState<SendHistoryEntry[]>([]);
  const [sendHistoryLoading, setSendHistoryLoading] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());

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
      setProjectFileLists(projectFromProps.fileLists || []);
      setPendingFileIds([]);
      setPendingListIds([]);
      setPendingLists([]);
      setIsDirty(false);
    } else {
      setName(new Date().toISOString().slice(0, 10));
      setDescription('');
      setAdminNotes('');
      setProjectFiles([]);
      setProjectFileLists([]);
      setPendingFileIds([]);
      setPendingListIds([]);
      setPendingLists([]);
      setIsDirty(false);
    }

    lastLoadedProjectIdRef.current = null;
    setFilesLoading(false);
    setExpandedListIds(new Set());
    setPendingListFilesCache({});
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
        setProjectFileLists(p.fileLists || []);
        setName(p.name || '');
        setDescription(p.description || '');
        setAdminNotes(p.adminNotes || '');
      })
      .catch(() => {})
      .finally(() => {
        if (seq === loadSeqRef.current) setFilesLoading(false);
      });
  }, [isCreate, projectId]);

  // When in edit mode with file lists that have fileIds, load all files once to resolve names
  useEffect(() => {
    if (isCreate || !projectFileLists.length) return;
    const allIds = new Set<string>();
    projectFileLists.forEach((fl) => (fl.fileIds || []).forEach((id) => allIds.add(String(id))));
    if (allIds.size === 0) return;
    filesApi
      .getItems()
      .then((items: any[]) => {
        const map: Record<string, string> = {};
        (items || []).forEach((f) => {
          if (f?.id) map[String(f.id)] = f.name || 'Namnlös';
        });
        setFileIdToName(map);
      })
      .catch(() => setFileIdToName({}));
  }, [isCreate, projectFileLists]);

  const toggleListExpanded = useCallback((key: string) => {
    setExpandedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const loadSendHistory = useCallback(() => {
    if (!projectId || isCreate) return;
    setSendHistoryLoading(true);
    inspectionApi
      .getSendHistory(projectId)
      .then((list) => setSendHistory(list || []))
      .catch(() => setSendHistory([]))
      .finally(() => setSendHistoryLoading(false));
  }, [projectId, isCreate]);

  const toggleHistoryExpanded = useCallback((id: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (isCreate || !projectId) return;
    loadSendHistory();
  }, [projectId, isCreate, loadSendHistory]);

  const loadPendingListFiles = useCallback((listId: string) => {
    setPendingListFilesCache((prev) => {
      if (prev[listId] !== undefined) return prev;
      filesApi
        .getListFiles(listId)
        .then((data) => {
          const files = Array.isArray(data) ? data : [];
          setPendingListFilesCache((p) => ({ ...p, [listId]: files }));
        })
        .catch(() => setPendingListFilesCache((p) => ({ ...p, [listId]: [] })));
      return prev;
    });
  }, []);

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

  const handleAddLists = useCallback(
    (listIds: string[], lists?: { id: string; name: string }[]) => {
      if (isCreate) {
        setPendingListIds((prev) => {
          const next = new Set(prev);
          listIds.forEach((id) => next.add(id));
          return Array.from(next);
        });
        if (lists?.length) {
          setPendingLists((prev) => {
            const byId = new Map(prev.map((l) => [l.id, l]));
            lists.forEach((l) => byId.set(l.id, l));
            return Array.from(byId.values());
          });
        }
        setShowListPicker(false);
        markDirty();
      } else if (projectId) {
        (async () => {
          try {
            const selectedSet = new Set(listIds.map(String));
            // Remove lists that are no longer selected (same behaviour as FilePicker: selection replaces)
            const toRemove = projectFileLists.filter((fl) => !selectedSet.has(String(fl.sourceListId)));
            for (const fl of toRemove) {
              await inspectionApi.removeFileList(projectId, fl.id);
            }
            // Add lists that are selected but not yet attached
            const attachedSourceIds = new Set(projectFileLists.map((fl) => String(fl.sourceListId)));
            const toAdd = listIds.filter((id) => !attachedSourceIds.has(String(id)));
            for (const listId of toAdd) {
              await inspectionApi.addFileList(projectId, listId);
            }
            const p = await inspectionApi.getProject(projectId);
            setProjectFileLists(p?.fileLists || []);
          } catch (e) {
            console.error('Failed to update lists:', e);
          } finally {
            setShowListPicker(false);
          }
        })();
      }
    },
    [isCreate, projectId, markDirty, projectFileLists]
  );

  const handleRemoveFileList = useCallback(
    async (fileListId: string) => {
      if (isCreate) {
        setPendingListIds((prev) => prev.filter((id) => id !== fileListId));
        setPendingLists((prev) => prev.filter((l) => l.id !== fileListId));
        markDirty();
        return;
      }
      if (!projectId) return;
      try {
        await inspectionApi.removeFileList(projectId, fileListId);
        setProjectFileLists((prev) => prev.filter((fl) => fl.id !== fileListId));
      } catch (e) {
        console.error('Failed to remove list:', e);
      }
    },
    [isCreate, projectId, markDirty]
  );

  const [projectForSendModal, setProjectForSendModal] = useState<InspectionProject | null>(null);

  const handleSaveAndSend = useCallback(async () => {
    clearValidationErrors();
    setSaving(true);
    try {
      const payload: any = { name, description, adminNotes, pendingFileIds, pendingListIds };
      const project = await saveInspectionAndStay(payload);
      if (project) {
        setProjectForSendModal(project);
        setShowSendModal(true);
        setIsDirty(false);
      }
    } catch {
      // validation errors set in context
    } finally {
      setSaving(false);
    }
  }, [name, description, adminNotes, pendingFileIds, pendingListIds, saveInspectionAndStay, clearValidationErrors]);

  const currentProject = projectFromProps ?? currentInspectionProject;
  const projectToSend = projectForSendModal ?? (currentProject ? { ...currentProject, files: projectFiles, fileLists: projectFileLists } : null);

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

          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={isCreate ? handleSaveAndSend : () => setShowSendModal(true)}
            disabled={isCreate && saving}
          >
            <Mail className="h-4 w-4 mr-2" />
            {isCreate ? 'Spara och skicka' : 'Skicka'}
          </Button>

          {!isCreate && projectId && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Utskickshistorik</Label>
              {sendHistoryLoading ? (
                <p className="text-sm text-muted-foreground">Laddar…</p>
              ) : sendHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga utskick ännu.</p>
              ) : (
                <ul className="space-y-1 border rounded-md divide-y">
                  {sendHistory.map((entry) => {
                    const isExpanded = expandedHistoryIds.has(entry.id);
                    const dateStr = entry.sentAt
                      ? new Date(entry.sentAt).toLocaleDateString('sv-SE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';
                    const fileCount = entry.metadata?.fileCount ?? '—';
                    const recipients = (entry.to || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    return (
                      <li key={entry.id} className="bg-card">
                        <div className="flex items-center gap-2 py-2 px-3">
                          <button
                            type="button"
                            aria-label={isExpanded ? 'Kollapsa' : 'Expandera'}
                            className="p-0.5 rounded hover:bg-muted"
                            onClick={() => toggleHistoryExpanded(entry.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          <span className="text-sm flex-1 min-w-0">{dateStr}</span>
                          <span className="text-sm text-muted-foreground shrink-0">
                            {fileCount} filer
                          </span>
                        </div>
                        {isExpanded && recipients.length > 0 && (
                          <div className="pl-8 pr-3 pb-2 pt-0 border-t">
                            <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">
                              Mottagare
                            </p>
                            <ul className="space-y-0.5">
                              {recipients.map((email, i) => (
                                <li key={i} className="text-xs truncate" title={email}>
                                  {email}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {validationErrors.map((e) => (
            <div key={e.field} className="text-sm text-destructive">
              {e.message}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex flex-col gap-3">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowFilePicker(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Lägg till fil
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowListPicker(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Lägg till lista
            </Button>
          </div>
          <div>
            <Label>Bifogade listor</Label>
            <Card className="p-3 mt-2">
              {isCreate ? (
                pendingLists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Inga listor bifogade</p>
                ) : (
                  <ul className="space-y-1">
                    {pendingLists.map((list) => {
                      const isExpanded = expandedListIds.has(list.id);
                      const files = pendingListFilesCache[list.id];
                      return (
                        <li key={list.id} className="border-b last:border-0">
                          <div className="flex items-center gap-1 py-2">
                            <button
                              type="button"
                              aria-label={isExpanded ? 'Kollapsa' : 'Expandera'}
                              className="p-0.5 rounded hover:bg-muted"
                              onClick={() => {
                                toggleListExpanded(list.id);
                                if (!isExpanded) loadPendingListFiles(list.id);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <span className="truncate flex-1 min-w-0">{list.name || 'Lista'}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0"
                              onClick={() => handleRemoveFileList(list.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          {isExpanded && (
                            <div className="ml-6 pl-2 border-l border-muted pb-2">
                              {files === undefined ? (
                                <p className="text-xs text-muted-foreground py-1">Laddar filer...</p>
                              ) : files.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">Inga filer i listan</p>
                              ) : (
                                <ul className="space-y-0.5 pt-1">
                                  {files.map((f: any) => (
                                    <li key={f.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <File className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate">{f.name || 'Namnlös'}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : projectFileLists.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga listor bifogade</p>
              ) : (
                <ul className="space-y-1">
                  {projectFileLists.map((fl) => {
                    const isExpanded = expandedListIds.has(fl.id);
                    const fileIds = fl.fileIds || [];
                    return (
                      <li key={fl.id} className="border-b last:border-0">
                        <div className="flex items-center gap-1 py-2">
                          <button
                            type="button"
                            aria-label={isExpanded ? 'Kollapsa' : 'Expandera'}
                            className="p-0.5 rounded hover:bg-muted"
                            onClick={() => toggleListExpanded(fl.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          <span className="truncate flex-1 min-w-0">{fl.sourceListName || 'Lista'}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={() => handleRemoveFileList(fl.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="ml-6 pl-2 border-l border-muted pb-2">
                            {fileIds.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-1">Inga filer i listan</p>
                            ) : (
                              <ul className="space-y-0.5 pt-1">
                                {fileIds.map((fileId) => (
                                  <li key={fileId} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <File className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{fileIdToName[fileId] || `Fil ${fileId}`}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {showListPicker && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <ListPicker
                selectedIds={isCreate ? pendingListIds : projectFileLists.map((fl) => fl.sourceListId)}
                onSelect={handleAddLists}
                onClose={() => setShowListPicker(false)}
              />
            </div>
          )}

          <div>
            <Label>Bifogade filer</Label>
            <Card className="p-3 mt-2">
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
        </div>
      </div>

      {showSendModal && projectToSend && (
        <SendModal
          project={projectToSend}
          onClose={() => {
            setShowSendModal(false);
            setProjectForSendModal(null);
          }}
          onSent={async () => {
            setPanelMode('edit');
            await loadProjects();
            loadSendHistory();
          }}
        />
      )}
    </div>
  );
};

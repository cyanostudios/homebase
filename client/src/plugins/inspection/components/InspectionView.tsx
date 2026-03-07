import { ChevronDown, ChevronRight, Download, Eye, File, Mail, Plus, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/core/ui/RichTextEditor';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { filesApi } from '@/plugins/files/api/filesApi';

import { inspectionApi, type SendHistoryEntry } from '../api/inspectionApi';
import { useInspections } from '../hooks/useInspections';
import type { InspectionProject, InspectionFile, InspectionFileList } from '../types/inspection';

import { FilePicker } from './FilePicker';
import { ListPicker } from './ListPicker';
import { SendModal } from './SendModal';

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

  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const isCreate = !projectFromProps?.id;
  const projectId = projectFromProps?.id ?? currentInspectionProject?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [projectFiles, setProjectFiles] = useState<InspectionFile[]>([]);
  const [projectFileLists, setProjectFileLists] = useState<InspectionFileList[] | undefined>(
    undefined,
  );
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([]);
  const [pendingListIds, setPendingListIds] = useState<string[]>([]);
  const [pendingLists, setPendingLists] = useState<{ id: string; name: string }[]>([]);
  const [filesList, setFilesList] = useState<{ id: string; name?: string }[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedListIds, setExpandedListIds] = useState<Set<string>>(new Set());
  const [pendingListFilesCache, setPendingListFilesCache] = useState<
    Record<string, { id: string; name?: string }[]>
  >({});
  const [fileIdToName, setFileIdToName] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [sendHistory, setSendHistory] = useState<SendHistoryEntry[]>([]);
  const [sendHistoryLoading, setSendHistoryLoading] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<InspectionFile | null>(null);

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
      setProjectFiles(projectFromProps.files);
      setProjectFileLists(projectFromProps.fileLists);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- projectFromProps stable
  }, [projectFromProps?.id]);

  useEffect(() => {
    if (isCreate || !projectId) {
      return;
    }

    if (lastLoadedProjectIdRef.current === String(projectId)) {
      return;
    }
    lastLoadedProjectIdRef.current = String(projectId);

    const seq = ++loadSeqRef.current;
    setFilesLoading(true);

    inspectionApi
      .getProject(projectId)
      .then((p) => {
        if (!p) {
          return;
        }
        if (seq !== loadSeqRef.current) {
          return;
        }

        setProjectFiles(p.files);
        setProjectFileLists(p.fileLists);
        setName(p.name || '');
        setDescription(p.description || '');
        setAdminNotes(p.adminNotes || '');
      })
      .catch(() => {})
      .finally(() => {
        if (seq === loadSeqRef.current) {
          setFilesLoading(false);
        }
      });
  }, [isCreate, projectId]);

  // When in edit mode with file lists that have fileIds, load all files once to resolve names
  useEffect(() => {
    if (isCreate || !projectFileLists?.length) {
      return;
    }
    const allIds = new Set<string>();
    projectFileLists.forEach((fl) => fl.fileIds.forEach((id) => allIds.add(String(id))));
    if (allIds.size === 0) {
      return;
    }
    filesApi
      .getItems()
      .then((items: any[]) => {
        const map: Record<string, string> = {};
        items.forEach((f) => {
          if (f?.id) {
            map[String(f.id)] = f.name || 'Namnlös';
          }
        });
        setFileIdToName(map);
      })
      .catch(() => setFileIdToName({}));
  }, [isCreate, projectFileLists]);

  const toggleListExpanded = useCallback((key: string) => {
    setExpandedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const loadSendHistory = useCallback(() => {
    if (!projectId || isCreate) {
      return;
    }
    setSendHistoryLoading(true);
    inspectionApi
      .getSendHistory(projectId)
      .then((list) => setSendHistory(list))
      .catch(() => setSendHistory([]))
      .finally(() => setSendHistoryLoading(false));
  }, [projectId, isCreate]);

  const toggleHistoryExpanded = useCallback((id: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (isCreate || !projectId) {
      return;
    }
    loadSendHistory();
  }, [projectId, isCreate, loadSendHistory]);

  const loadPendingListFiles = useCallback((listId: string) => {
    setPendingListFilesCache((prev) => {
      if (prev[listId] !== undefined) {
        return prev;
      }
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
    if (!isCreate) {
      return;
    }
    if (!showFilePicker) {
      return;
    }
    if (filesList.length > 0) {
      return;
    }

    filesApi
      .getItems()
      .then((items) => setFilesList(items))
      .catch(() => {});
  }, [isCreate, showFilePicker, filesList.length]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleSave = useCallback(async () => {
    if (saving) {
      return;
    }
    clearValidationErrors();
    setSaving(true);

    try {
      const payload: any = { name, description, adminNotes };
      if (isCreate) {
        payload.pendingFileIds = pendingFileIds;
        payload.pendingListIds = pendingListIds;
      }

      const ok = onSave ? await onSave(payload) : await saveInspectionAndClose(payload);

      if (ok) {
        setIsDirty(false);
      }
      if (!ok) {
        setSaving(false);
      }
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
    pendingListIds,
    onSave,
    saveInspectionAndClose,
  ]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      closeInspectionPanel();
    }
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
      if (!projectId) {
        return;
      }

      try {
        const p = await inspectionApi.setFiles(projectId, fileIds);

        setProjectFiles(p.files);
        setName(p?.name || '');
        setDescription(p?.description || '');
        setAdminNotes(p?.adminNotes || '');
        setShowFilePicker(false);
      } catch (e) {
        console.error('Failed to set files:', e);
      }
    },
    [projectId],
  );

  const handleRemoveFile = useCallback(
    async (fileId: string) => {
      if (!projectId) {
        return;
      }

      try {
        const p = await inspectionApi.removeFile(projectId, fileId);
        setProjectFiles(p.files);
      } catch (e) {
        console.error('Failed to remove file:', e);
      }
    },
    [projectId],
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
      } else if (projectId && Array.isArray(projectFileLists)) {
        (async () => {
          try {
            const selectedSet = new Set(listIds.map(String));
            // Remove lists that are no longer selected (same behaviour as FilePicker: selection replaces)
            const toRemove = projectFileLists.filter(
              (fl) => !selectedSet.has(String(fl.sourceListId)),
            );
            for (const fl of toRemove) {
              await inspectionApi.removeFileList(projectId, fl.id);
            }
            // Add lists that are selected but not yet attached
            const attachedSourceIds = new Set(
              projectFileLists.map((fl) => String(fl.sourceListId)),
            );
            const toAdd = listIds.filter((id) => !attachedSourceIds.has(String(id)));
            for (const listId of toAdd) {
              await inspectionApi.addFileList(projectId, listId);
            }
            const p = await inspectionApi.getProject(projectId);
            setProjectFileLists(p.fileLists);
          } catch (e) {
            console.error('Failed to update lists:', e);
          } finally {
            setShowListPicker(false);
          }
        })();
      }
    },
    [isCreate, projectId, markDirty, projectFileLists],
  );

  const handleRemoveFileList = useCallback(
    async (fileListId: string) => {
      if (isCreate) {
        setPendingListIds((prev) => prev.filter((id) => id !== fileListId));
        setPendingLists((prev) => prev.filter((l) => l.id !== fileListId));
        markDirty();
        return;
      }
      if (!projectId) {
        return;
      }
      try {
        await inspectionApi.removeFileList(projectId, fileListId);
        setProjectFileLists((prev) =>
          prev === undefined ? undefined : prev.filter((fl) => fl.id !== fileListId),
        );
      } catch (e) {
        console.error('Failed to remove list:', e);
      }
    },
    [isCreate, projectId, markDirty],
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
  }, [
    name,
    description,
    adminNotes,
    pendingFileIds,
    pendingListIds,
    saveInspectionAndStay,
    clearValidationErrors,
  ]);

  const currentProject = projectFromProps ?? currentInspectionProject;
  const projectToSend =
    projectForSendModal ??
    (currentProject
      ? {
          ...currentProject,
          name,
          description,
          adminNotes,
          files: projectFiles,
          fileLists: projectFileLists,
        }
      : null);

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
            <RichTextEditor
              value={description}
              onChange={(val) => {
                setDescription(val);
                markDirty();
              }}
              placeholder="Vad ska besiktigas?"
              minHeight={160}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="inspection-adminNotes">Admin-kommentarer</Label>
            <RichTextEditor
              value={adminNotes}
              onChange={(val) => {
                setAdminNotes(val);
                markDirty();
              }}
              placeholder="Egna anteckningar..."
              minHeight={200}
              className="mt-1"
            />
          </div>

          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={isCreate ? handleSaveAndSend : () => setShowSendModal(true)}
            disabled={(isCreate && saving) || (!isCreate && projectFileLists === undefined)}
            title={!isCreate && projectFileLists === undefined ? 'Laddar listor...' : undefined}
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
                              {recipients.map((email) => (
                                <li key={email} className="text-xs truncate" title={email}>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilePicker(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Lägg till fil
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowListPicker(true)}
            >
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
                                if (!isExpanded) {
                                  loadPendingListFiles(list.id);
                                }
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
                                <p className="text-xs text-muted-foreground py-1">
                                  Laddar filer...
                                </p>
                              ) : files.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">
                                  Inga filer i listan
                                </p>
                              ) : (
                                <ul className="space-y-0.5 pt-1">
                                  {files.map((f: any) => (
                                    <li
                                      key={f.id}
                                      className="flex items-center gap-2 text-xs text-muted-foreground"
                                    >
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
              ) : projectFileLists === undefined ? (
                <p className="text-sm text-muted-foreground">Laddar listor…</p>
              ) : projectFileLists.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga listor bifogade</p>
              ) : (
                <ul className="space-y-1">
                  {projectFileLists.map((fl) => {
                    const isExpanded = expandedListIds.has(fl.id);
                    const fileIds = fl.fileIds;
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
                          <span className="truncate flex-1 min-w-0">
                            {fl.sourceListName || 'Lista'}
                          </span>
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
                              <p className="text-xs text-muted-foreground py-1">
                                Inga filer i listan
                              </p>
                            ) : (
                              <ul className="space-y-0.5 pt-1">
                                {fileIds.map((fileId) => (
                                  <li
                                    key={fileId}
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <File className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">
                                      {fileIdToName[fileId] || `Fil ${fileId}`}
                                    </span>
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
              {projectFileLists === undefined && !isCreate ? (
                <p className="text-sm text-muted-foreground">Laddar listor…</p>
              ) : (
                <ListPicker
                  selectedIds={
                    isCreate ? pendingListIds : projectFileLists!.map((fl) => fl.sourceListId)
                  }
                  onSelect={handleAddLists}
                  onClose={() => setShowListPicker(false)}
                />
              )}
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
                      <li
                        key={id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
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
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <File className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{f.name || 'Namnlös'}</span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {f.url && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPreviewFile(f)}
                              title="Förhandsgranska"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <a
                              href={`${f.url}?download=1`}
                              download={f.name || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                              title="Ladda ner"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveFile(f.id)}
                          title="Ta bort"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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

      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewFile?.name || 'Förhandsgranskning'}</DialogTitle>
          </DialogHeader>
          {previewFile?.url && (
            <div className="flex-1 min-h-0 overflow-auto">
              {previewFile.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name || 'PDF'}
                  className="w-full h-[70vh] min-h-[400px] border rounded"
                />
              ) : (previewFile.mimeType?.startsWith('image/') ?? false) ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name || 'Bild'}
                  className="max-w-full max-h-[70vh] object-contain mx-auto block"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-muted-foreground">
                  <p>Filtypen kan inte förhandsgranskas.</p>
                  <a
                    href={`${previewFile.url}?download=1`}
                    download={previewFile.name || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    <Download className="h-4 w-4" />
                    Ladda ner
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

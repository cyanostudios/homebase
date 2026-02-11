import { ChevronDown, ChevronRight, File, Mail, Send } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { filesApi } from '@/plugins/files/api/filesApi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { inspectionApi } from '../api/inspectionApi';
import type { InspectionProject, InspectionFileList } from '../types/inspection';

interface SendModalProps {
  project: InspectionProject;
  onClose: () => void;
  onSent: () => void;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export const SendModal: React.FC<SendModalProps> = ({ project, onClose, onSent }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualEmail, setManualEmail] = useState('');
  const [includeDescription, setIncludeDescription] = useState(true);
  const [includeAdminNotes, setIncludeAdminNotes] = useState(true);
  const fileLists = project.fileLists || [];
  const [selectedListIds, setSelectedListIds] = useState<string[]>(
    fileLists.map((fl: InspectionFileList) => fl.id)
  );
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>(
    (project.files || []).map((f) => f.id)
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedListIds, setExpandedListIds] = useState<Set<string>>(new Set());
  const [fileIdToName, setFileIdToName] = useState<Record<string, string>>({});

  const toggleListExpanded = useCallback((id: string) => {
    setExpandedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const allIds = new Set<string>();
    fileLists.forEach((fl) => (fl.fileIds || []).forEach((id) => allIds.add(String(id))));
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
  }, [fileLists]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/contacts', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setContacts(data || []);
        }
      } catch (e) {
        console.error('Failed to load contacts:', e);
      }
    };
    load();
  }, []);

  const addRecipient = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (isEmail(v)) {
      if (!recipients.includes(v)) setRecipients([...recipients, v]);
      setManualEmail('');
    } else {
      const c = contacts.find(
        (x) =>
          String(x.id) === v ||
          (x.companyName || '').toLowerCase() === v.toLowerCase()
      );
      if (c?.email && !recipients.includes(c.email)) {
        setRecipients([...recipients, c.email]);
      }
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      setError('Lägg till minst en mottagare');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await inspectionApi.send(project.id, {
        recipients,
        includeDescription,
        includeAdminNotes,
        listIds: selectedListIds.length > 0 ? selectedListIds : undefined,
        fileIds: selectedFileIds.length > 0 ? selectedFileIds : undefined,
      });
      if (res?.logEntry) {
        window.dispatchEvent(new CustomEvent('mailSent', { detail: res.logEntry }));
      }
      onSent();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Kunde inte skicka');
    } finally {
      setSending(false);
    }
  };

  const contactsWithEmail = contacts.filter((c) => c.email);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-full h-[75vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Skicka
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-auto min-h-0">
          <div className="space-y-4">
            <div>
              <Label>Mottagare</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {recipients.map((r) => (
                <Badge
                  key={r}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => removeRecipient(r)}
                >
                  {r} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="E-post eller välj kontakt nedan"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRecipient(manualEmail);
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRecipient(manualEmail)}
              >
                Lägg till
              </Button>
            </div>
            <ScrollArea className="h-24 mt-2 border rounded-md">
              <div className="p-2 space-y-1">
                {contactsWithEmail.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addRecipient(c.email)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded"
                  >
                    {c.companyName || c.email} — {c.email}
                  </button>
                ))}
              </div>
            </ScrollArea>
            </div>

            <div className="space-y-2">
              <Label>Inkludera i mailet</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inc-desc"
                checked={includeDescription}
                onCheckedChange={(v) => setIncludeDescription(!!v)}
              />
              <label htmlFor="inc-desc">Beskrivning</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inc-notes"
                checked={includeAdminNotes}
                onCheckedChange={(v) => setIncludeAdminNotes(!!v)}
              />
              <label htmlFor="inc-notes">Admin-kommentarer</label>
            </div>
            </div>
          </div>

          <div className="space-y-4 overflow-auto min-h-0">
            <div>
              <Label>Bifogade listor</Label>
              <ScrollArea className="h-40 mt-2 border rounded-md">
                <div className="p-2 space-y-1">
                  {fileLists.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Inga listor bifogade</p>
                  ) : (
                    fileLists.map((fl) => {
                      const isExpanded = expandedListIds.has(fl.id);
                      const fileIds = fl.fileIds || [];
                      return (
                        <div key={fl.id} className="border-b border-muted/50 last:border-0">
                          <div className="flex items-center gap-1 py-1.5">
                            <button
                              type="button"
                              aria-label={isExpanded ? 'Kollapsa' : 'Expandera'}
                              className="p-0.5 rounded hover:bg-muted shrink-0"
                              onClick={() => toggleListExpanded(fl.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <Checkbox
                              id={`list-${fl.id}`}
                              checked={selectedListIds.includes(fl.id)}
                              onCheckedChange={(v) => {
                                if (v) setSelectedListIds([...selectedListIds, fl.id]);
                                else setSelectedListIds(selectedListIds.filter((id) => id !== fl.id));
                              }}
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label htmlFor={`list-${fl.id}`} className="text-sm truncate flex-1 cursor-pointer">
                              {fl.sourceListName || 'Lista'}
                            </label>
                          </div>
                          {isExpanded && (
                            <div className="ml-6 pl-2 border-l border-muted pb-1.5">
                              {fileIds.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">Inga filer i listan</p>
                              ) : (
                                <ul className="space-y-0.5 pt-1">
                                  {fileIds.map((fileId) => (
                                    <li key={fileId} className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <File className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{fileIdToName[fileId] || `Fil ${fileId}`}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
            <div>
              <Label>Bifogade filer</Label>
              <ScrollArea className="h-32 mt-2 border rounded-md">
                <div className="p-2 space-y-1">
                  {(project.files || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Inga filer bifogade</p>
                  ) : (
                    (project.files || []).map((f) => (
                      <div key={f.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`file-${f.id}`}
                          checked={selectedFileIds.includes(f.id)}
                          onCheckedChange={(v) => {
                            if (v) setSelectedFileIds([...selectedFileIds, f.id]);
                            else setSelectedFileIds(selectedFileIds.filter((id) => id !== f.id));
                          }}
                        />
                        <label htmlFor={`file-${f.id}`} className="text-sm">
                          {f.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Skickar...' : 'Skicka'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

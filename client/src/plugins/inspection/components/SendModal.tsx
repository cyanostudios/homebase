import { Mail, Send } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { InspectionProject } from '../types/inspection';

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
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>(
    (project.files || []).map((f) => f.id)
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        fileIds: selectedFileIds,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Skicka till hantverkare
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
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

          <div>
            <Label>Bifogade filer</Label>
            <div className="mt-2 space-y-1">
              {(project.files || []).map((f) => (
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
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
        </div>

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

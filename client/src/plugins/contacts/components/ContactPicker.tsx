import { Search, User } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { contactsApi } from '../api/contactsApi';

export interface ContactPickerProps {
  selectedIds: string[];
  onSelect: (contactIds: string[]) => void;
  onClose: () => void;
  /** Optional label for confirm button (default: "Lägg till valda") */
  confirmLabel?: string;
}

export const ContactPicker: React.FC<ContactPickerProps> = ({
  selectedIds,
  onSelect,
  onClose,
  confirmLabel = 'Lägg till valda',
}) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  useEffect(() => {
    setSelected(new Set(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    contactsApi
      .getContacts()
      .then((data) => setContacts(data || []))
      .catch((err) => console.error('Failed to load contacts:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(
    (c) =>
      !search ||
      (c.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contactNumber || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleConfirm = () => {
    onSelect(Array.from(selected));
  };

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök kontakter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 border rounded-md">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Laddar...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Inga kontakter hittades</div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((c) => {
              const id = String(c.id);
              const isSelected = selected.has(id);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm hover:bg-muted ${
                    isSelected ? 'bg-primary/10' : ''
                  }`}
                >
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1">{c.companyName || c.email || 'Namnlös'}</span>
                  {c.email && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {c.email}
                    </span>
                  )}
                  {isSelected && <span className="text-primary text-xs">Vald</span>}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
        <Button variant="outline" onClick={onClose}>
          Avbryt
        </Button>
        <Button onClick={handleConfirm}>
          {confirmLabel} ({selected.size})
        </Button>
      </div>
    </div>
  );
};

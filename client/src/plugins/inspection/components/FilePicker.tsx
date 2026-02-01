import { File, Search } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { filesApi } from '@/plugins/files/api/filesApi';

interface FilePickerProps {
  selectedIds: string[];
  onSelect: (fileIds: string[]) => void;
  onClose: () => void;
}

export const FilePicker: React.FC<FilePickerProps> = ({ selectedIds, onSelect, onClose }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  useEffect(() => {
    const load = async () => {
      try {
        const data = await filesApi.getItems();
        setFiles(data || []);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = files.filter(
    (f) =>
      !search ||
      (f.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleConfirm = () => {
    onSelect(Array.from(selected));
    onClose();
  };

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök filer..."
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
          <div className="p-4 text-sm text-muted-foreground">Inga filer hittades</div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm hover:bg-muted ${
                  selected.has(f.id) ? 'bg-primary/10' : ''
                }`}
              >
                <File className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">{f.name || 'Namnlös'}</span>
                {selected.has(f.id) && <span className="text-primary text-xs">Vald</span>}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
        <Button variant="outline" onClick={onClose}>
          Avbryt
        </Button>
        <Button onClick={handleConfirm}>Lägg till valda ({selected.size})</Button>
      </div>
    </div>
  );
};

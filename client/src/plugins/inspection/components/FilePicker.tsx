import { File, Search } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

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

  // Guard för React StrictMode i dev: undvik dubbel fetch + race
  const didLoadRef = useRef(false);
  const loadSeqRef = useRef(0);

  // Håll selected i synk om parent skickar nya selectedIds (t.ex. när man öppnar om pickern)
  useEffect(() => {
    setSelected(new Set(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    if (didLoadRef.current) {
      return;
    }
    didLoadRef.current = true;

    const seq = ++loadSeqRef.current;

    const load = async () => {
      try {
        const data = await filesApi.getItems();
        if (seq !== loadSeqRef.current) {
          return;
        }
        setFiles(data);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    };

    load();
  }, []);

  const filtered = files.filter(
    (f) => !search || (f.name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    const key = String(id);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelected(next);
  };

  const handleConfirm = () => {
    // Viktigt: här ska vi inte också stänga parent igen om parent redan stänger.
    // Vi låter parent bestämma vad som händer efter onSelect.
    onSelect(Array.from(selected));
  };

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök filer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={onClose}>
            Avbryt
          </Button>
          <Button size="sm" className="h-9" onClick={handleConfirm}>
            Lägg till valda ({selected.size})
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 border rounded-md">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Laddar...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Inga filer hittades</div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((f) => {
              const id = String(f.id);
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
                  <File className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1">{f.name || 'Namnlös'}</span>
                  {isSelected && <span className="text-primary text-xs">Vald</span>}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

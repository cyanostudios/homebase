import { ChevronDown, ChevronRight, File, FolderOpen, Search } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { filesApi } from '@/plugins/files/api/filesApi';

export interface ListPickerProps {
  selectedIds: string[];
  onSelect: (listIds: string[], lists?: { id: string; name: string }[]) => void;
  onClose: () => void;
}

export const ListPicker: React.FC<ListPickerProps> = ({ selectedIds, onSelect, onClose }) => {
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [listFiles, setListFiles] = useState<Record<string, any[]>>({});

  useEffect(() => {
    setSelected(new Set(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    filesApi
      .getLists()
      .then((data) => setLists(data))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, []);

  const loadListFiles = (listId: string) => {
    if (listFiles[listId] !== undefined) return;
    filesApi
      .getListFiles(listId)
      .then((files) => setListFiles((prev) => ({ ...prev, [listId]: Array.isArray(files) ? files : [] })))
      .catch(() => setListFiles((prev) => ({ ...prev, [listId]: [] })));
  };

  const toggleExpand = (listId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else {
        next.add(listId);
        loadListFiles(listId);
      }
      return next;
    });
  };

  const toggleList = (listId: string) => {
    const next = new Set(selected);
    if (next.has(listId)) next.delete(listId);
    else next.add(listId);
    setSelected(next);
  };

  const handleConfirm = () => {
    const ids = Array.from(selected);
    const selectedLists = lists.filter((l) => selected.has(l.id));
    onSelect(ids, selectedLists);
  };

  const needle = search.trim().toLowerCase();
  const filteredLists = useMemo(() => {
    if (!needle) return lists;
    return lists.filter((list) => (list.name || '').toLowerCase().includes(needle));
  }, [lists, needle]);

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Sök listor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
            aria-label="Sök listor"
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
          <div className="p-4 text-sm text-muted-foreground">Laddar listor...</div>
        ) : lists.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Inga listor. Skapa listor under Filer.</div>
        ) : filteredLists.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Inga listor matchar sökningen.</div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredLists.map((list) => {
              const isSelected = selected.has(list.id);
              const isExpanded = expandedIds.has(list.id);
              const files = listFiles[list.id];
              const loadingFiles = isExpanded && files === undefined;

              return (
                <div key={list.id}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={isExpanded ? 'Kollapsa' : 'Expandera'}
                      className="p-0.5 rounded hover:bg-muted"
                      onClick={() => toggleExpand(list.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleList(list.id)}
                      className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm hover:bg-muted min-w-0 ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                    >
                      <FolderOpen className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate flex-1">{list.name || 'Namnlös lista'}</span>
                      {isSelected && <span className="text-primary text-xs">Vald</span>}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="ml-6 pl-2 border-l border-muted">
                      {loadingFiles ? (
                        <div className="py-2 text-xs text-muted-foreground">Laddar filer...</div>
                      ) : Array.isArray(files) && files.length > 0 ? (
                        <div className="py-1 space-y-0.5">
                          {files.map((f: any) => (
                            <div
                              key={f.id}
                              className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                            >
                              <File className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{f.name || 'Namnlös'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-2 text-xs text-muted-foreground">Inga filer i listan</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

import { Check, Grip, Plus, Settings2, Trash2, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { useRequests } from '../hooks/useRequests';
import { BUILTIN_REQUEST_TYPE_KEYS, getTypeLabel } from '../types/requests';

interface RequestsSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function RequestsSettingsView({ inlineTrailing }: RequestsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { requestTypes, saveRequestTypes } = useRequests();

  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(async () => {
    const label = newTypeLabel.trim();
    if (!label) return;
    if (requestTypes.includes(label)) return;
    setIsSaving(true);
    try {
      await saveRequestTypes([...requestTypes, label]);
      setNewTypeLabel('');
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  }, [newTypeLabel, requestTypes, saveRequestTypes]);

  const handleRemove = useCallback(
    async (type: string) => {
      setIsSaving(true);
      try {
        await saveRequestTypes(requestTypes.filter((t) => t !== type));
        setConfirmDeleteKey(null);
      } finally {
        setIsSaving(false);
      }
    },
    [requestTypes, saveRequestTypes],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const reorderTypes = useCallback(
    async (sourceType: string, targetType: string) => {
      if (sourceType === targetType) return;
      const fromIndex = requestTypes.indexOf(sourceType);
      const toIndex = requestTypes.indexOf(targetType);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

      const next = [...requestTypes];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      setIsSaving(true);
      try {
        await saveRequestTypes(next);
      } finally {
        setIsSaving(false);
      }
    },
    [requestTypes, saveRequestTypes],
  );

  const handleDragStart = (e: React.DragEvent, type: string) => {
    setDraggingType(type);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', type);
  };

  const handleDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingType && draggingType !== type) {
      setDragOverType(type);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetType: string) => {
    e.preventDefault();
    const sourceType = e.dataTransfer.getData('text/plain') || draggingType;
    if (sourceType) {
      await reorderTypes(sourceType, targetType);
    }
    setDraggingType(null);
    setDragOverType(null);
  };

  const handleDragEnd = () => {
    setDraggingType(null);
    setDragOverType(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('requests.settings.title')}
          </h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">{inlineTrailing}</div>
      </div>

      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" />
              <span>{t('requests.settings.typesSection')}</span>
            </div>
          }
          className="pt-0"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('requests.settings.typesHint')}</p>

            <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
              {requestTypes.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  {t('requests.settings.noTypes')}
                </li>
              )}
              {requestTypes.map((type) => {
                const isBuiltin = BUILTIN_REQUEST_TYPE_KEYS.includes(type);
                const label = getTypeLabel(type, t);
                const isConfirming = confirmDeleteKey === type;

                return (
                  <li
                    key={type}
                    draggable={!isSaving}
                    onDragStart={(e) => handleDragStart(e, type)}
                    onDragOver={(e) => handleDragOver(e, type)}
                    onDrop={(e) => void handleDrop(e, type)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={() => {
                      if (dragOverType === type) setDragOverType(null);
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                      draggingType === type && 'opacity-50',
                      dragOverType === type && 'bg-muted/60',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Grip
                        className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                        aria-hidden
                      />
                      <span className="text-sm font-medium">{label}</span>
                      {isBuiltin && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t('requests.settings.builtIn')}
                        </span>
                      )}
                    </div>

                    {isConfirming ? (
                      <div className="flex items-center gap-1">
                        <span className="mr-1 text-xs text-muted-foreground">
                          {t('requests.settings.confirmRemove')}
                        </span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          icon={Check}
                          className="h-7 px-2 text-xs"
                          disabled={isSaving}
                          onClick={() => handleRemove(type)}
                        >
                          {t('common.yes')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={X}
                          className="h-7 px-2 text-xs"
                          onClick={() => setConfirmDeleteKey(null)}
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDeleteKey(type)}
                        title={t('common.remove')}
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2 pt-1">
              <Input
                ref={inputRef}
                value={newTypeLabel}
                onChange={(e) => setNewTypeLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('requests.settings.addTypePlaceholder')}
                className="h-8 max-w-xs text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                className="h-8 px-2.5 text-xs"
                disabled={!newTypeLabel.trim() || isSaving}
                onClick={handleAdd}
              >
                {t('requests.settings.addType')}
              </Button>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  );
}

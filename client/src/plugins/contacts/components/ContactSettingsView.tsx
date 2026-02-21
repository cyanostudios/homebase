// Contacts settings as full-page content (like Core Settings and Notes): tab row + card + footer.

import { Check, LayoutGrid, List, Plus, Tag, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import type { ImportSchema } from '@/core/utils/importUtils';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';

const CONTACTS_SETTINGS_KEY = 'contacts';

type ContactViewMode = 'grid' | 'list';

const getContactImportSchema = (): ImportSchema => ({
  fields: [
    { key: 'companyName', label: 'Name', required: true },
    { key: 'contactType', label: 'Type', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
});

interface ContactSettingsCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const getContactSettingsCategories = (t: (key: string) => string): ContactSettingsCategory[] => [
  { id: 'view', label: 'View', icon: LayoutGrid },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'import', label: t('common.import'), icon: Upload },
];

export function ContactSettingsView() {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
  const { getSettings, updateSettings } = useApp();
  const { importContacts } = useContacts();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('view');
  const [viewMode, setViewMode] = useState<ContactViewMode>('grid');
  const [initialViewMode, setInitialViewMode] = useState<ContactViewMode>('grid');
  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setHeaderTrailing(
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {getContactSettingsCategories(t).map((category) => {
          const Icon = category.icon;
          const isActive = selectedCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setSelectedCategory(category.id)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                'flex items-center gap-1.5 sm:gap-2',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{category.label}</span>
            </Button>
          );
        })}
      </div>,
    );
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, selectedCategory, t]);

  useEffect(() => {
    let cancelled = false;
    getSettings(CONTACTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedView = settings?.viewMode === 'list' ? 'list' : 'grid';
        setViewMode(loadedView);
        setInitialViewMode(loadedView);
        const loadedTags = Array.isArray(settings?.tags)
          ? settings.tags
              .filter((t: unknown) => typeof t === 'string')
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [];
        setTags(loadedTags);
        setInitialTags(loadedTags);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings]);

  const tagsEqual =
    tags.length === initialTags.length && tags.every((t, i) => t === initialTags[i]);
  const isDirty = viewMode !== initialViewMode || !tagsEqual;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(CONTACTS_SETTINGS_KEY, { viewMode, tags });
      setInitialViewMode(viewMode);
      setInitialTags([...tags]);
    } catch (error) {
      console.error('Failed to save contacts settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [viewMode, tags, updateSettings]);

  const addTag = useCallback(() => {
    const next = newTag.trim();
    if (!next) {
      return;
    }
    const exists = tags.some((tag) => tag.toLowerCase() === next.toLowerCase());
    if (exists) {
      setNewTag('');
      return;
    }
    setTags((prev) => [...prev, next]);
    setNewTag('');
  }, [newTag, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const viewModes: {
    id: ContactViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
  ];

  return (
    <div className="space-y-4">
      <Card
        padding="md"
        className="overflow-hidden border border-border/60 bg-background/50 shadow-sm"
      >
        {selectedCategory === 'view' && (
          <DetailSection title="Default view" className="pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              {viewModes.map((mode) => {
                const ModeIcon = mode.icon;
                const isActive = viewMode === mode.id;
                return (
                  <Button
                    key={mode.id}
                    variant="ghost"
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      'h-9 text-xs px-3 rounded-lg font-medium',
                      'flex items-center gap-1.5',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                  >
                    <ModeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{mode.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Contacts will be displayed in the selected layout by default.
            </p>
          </DetailSection>
        )}

        {selectedCategory === 'tags' && (
          <DetailSection title="Tags" className="pt-0">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tags can be assigned to contacts in Contact Properties.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag (e.g. Family, Work)"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={addTag}
                  disabled={!newTag.trim()}
                  className="h-9 text-xs px-3"
                >
                  Add
                </Button>
              </div>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                      <span>{tag}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 min-w-5 p-0 rounded hover:bg-muted"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </DetailSection>
        )}

        {selectedCategory === 'import' && (
          <DetailSection title={t('common.import')} className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              {t('contacts.importDescription') ||
                'Import contacts from a CSV file. Columns: Name, Type, Email, Phone, Notes.'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              icon={Upload}
              onClick={() => setIsImportWizardOpen(true)}
              className="h-9 text-xs px-3"
            >
              {t('common.import')}
            </Button>
          </DetailSection>
        )}
      </Card>

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importContacts}
        schema={getContactImportSchema()}
        title={t('common.import')}
      />

      {isDirty && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}

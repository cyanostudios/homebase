import { Check, Plus, Search, Settings, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MOBILE_FLOATING_CHROME_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import {
  useMobileActionsBar,
  useMobileBarOverrideBar,
  useMobileSearchBar,
} from './MobileActionsContext';

interface MobileBottomBarProps {
  detailPanelOpen?: boolean;
}

export function MobileBottomBar({ detailPanelOpen = false }: MobileBottomBarProps) {
  const { t } = useTranslation();
  const actions = useMobileActionsBar();
  const barOverride = useMobileBarOverrideBar();
  const { search, searchOpen, setSearchOpen } = useMobileSearchBar();
  const inputRef = useRef<HTMLInputElement>(null);

  const hasSearch = Boolean(search);
  const hasAdd = Boolean(actions.onAdd);
  const hasSettings = Boolean(actions.onSettings);
  const searchHasValue = Boolean(search?.value.trim());
  const hasOverride = Boolean(barOverride?.onClose);

  const handleSearchToggle = useCallback(() => {
    if (!hasSearch) {
      return;
    }
    setSearchOpen(!searchOpen);
  }, [hasSearch, searchOpen, setSearchOpen]);

  const handleAdd = useCallback(() => {
    setSearchOpen(false);
    actions.onAdd?.();
  }, [actions.onAdd, setSearchOpen]);

  const handleSettings = useCallback(() => {
    setSearchOpen(false);
    actions.onSettings?.();
  }, [actions.onSettings, setSearchOpen]);

  const handleClearSearch = useCallback(() => {
    search?.onChange('');
  }, [search]);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, [setSearchOpen]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, setSearchOpen]);

  if (detailPanelOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
      aria-label={t('common.mobileActions')}
    >
      <div className="pointer-events-auto flex flex-col gap-2">
        {hasOverride ? (
          <div
            className={cn('flex w-full items-center gap-2 px-2 py-2', MOBILE_FLOATING_CHROME_CLASS)}
          >
            <Button
              type="button"
              onClick={() => barOverride?.onClose()}
              variant="secondary"
              size="sm"
              icon={X}
              className="h-9 flex-1 px-3 text-xs shadow-sm"
            >
              {t('common.close')}
            </Button>
            {barOverride?.onSave ? (
              <Button
                type="button"
                onClick={() => barOverride.onSave?.()}
                variant="primary"
                size="sm"
                icon={Check}
                disabled={barOverride.saveDisabled || barOverride.isSaving}
                className="h-9 flex-1 border-none bg-green-600 px-3 text-xs text-white shadow-sm hover:bg-green-700"
              >
                {barOverride.isSaving ? t('common.saving') : t('common.save')}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {searchOpen && search ? (
              <div
                className={cn('flex items-center gap-2 px-2 py-2', MOBILE_FLOATING_CHROME_CLASS)}
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    type="text"
                    value={search.value}
                    onChange={(event) => search.onChange(event.target.value)}
                    placeholder={search.placeholder ?? t('common.search')}
                    className={cn(
                      'h-10 bg-background/80 pl-9 text-sm shadow-sm',
                      searchHasValue ? 'pr-8' : undefined,
                    )}
                    aria-label={t('common.search')}
                  />
                  {searchHasValue ? (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={handleClearSearch}
                      aria-label={t('common.clearSearch')}
                      title={t('common.clearSearch')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="flex h-10 shrink-0 items-center rounded-md bg-background/80 px-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                  onClick={handleCloseSearch}
                  aria-label={t('common.close')}
                >
                  {t('common.close')}
                </button>
              </div>
            ) : null}

            <div className={cn('flex h-14 items-stretch', MOBILE_FLOATING_CHROME_CLASS)}>
              <button
                type="button"
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
                  hasSearch
                    ? searchOpen || searchHasValue
                      ? 'text-foreground active:bg-background/40'
                      : 'text-muted-foreground active:bg-background/40 hover:text-foreground'
                    : 'cursor-not-allowed text-muted-foreground/40',
                )}
                onClick={handleSearchToggle}
                disabled={!hasSearch}
                aria-label={t('common.search')}
                aria-pressed={searchOpen}
              >
                <Search className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{t('common.search')}</span>
              </button>

              <button
                type="button"
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
                  hasAdd
                    ? 'text-muted-foreground active:bg-background/40 hover:text-foreground'
                    : 'cursor-not-allowed text-muted-foreground/40',
                )}
                onClick={handleAdd}
                disabled={!hasAdd}
                aria-label={t('common.add')}
              >
                <Plus className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{t('common.add')}</span>
              </button>

              <button
                type="button"
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
                  hasSettings
                    ? 'text-muted-foreground active:bg-background/40 hover:text-foreground'
                    : 'cursor-not-allowed text-muted-foreground/40',
                )}
                onClick={handleSettings}
                disabled={!hasSettings}
                aria-label={t('common.settings')}
              >
                <Settings className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{t('common.settings')}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </nav>,
    document.body,
  );
}

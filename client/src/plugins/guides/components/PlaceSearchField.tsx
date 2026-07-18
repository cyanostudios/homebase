import { Loader2, MapPin, Search, X } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

import { placesApi } from '../api/placesApi';
import type { PlaceResolved } from '../types/guides';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

interface PlaceSearchFieldProps {
  value: PlaceResolved | null;
  geographicReferenceFallback?: string | null;
  onChange: (place: PlaceResolved | null, geographicReference: string | null) => void;
  disabled?: boolean;
}

function manualPlace(query: string): PlaceResolved {
  return {
    provider: 'manual',
    providerRef: null,
    displayName: query.trim(),
    formattedAddress: null,
    coordinates: null,
    countryCode: null,
    adminArea: null,
    locality: null,
    placeTypes: [],
    bbox: null,
    resolvedAt: new Date().toISOString(),
  };
}

function legacyToManual(geographicReference: string): PlaceResolved {
  return manualPlace(geographicReference);
}

export const PlaceSearchField: React.FC<PlaceSearchFieldProps> = ({
  value,
  geographicReferenceFallback,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResolved[]>([]);
  const [attribution, setAttribution] = useState<string | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<number | null>(null);

  const resolved =
    value ?? (geographicReferenceFallback ? legacyToManual(geographicReferenceFallback) : null);
  const isEditing = !resolved;

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setSearching(true);
      setSearchError(false);
      void placesApi
        .search(q)
        .then((res) => {
          setResults(res.results);
          setAttribution(res.attribution);
          setActiveIndex(-1);
        })
        .catch(() => {
          setResults([]);
          setSearchError(true);
          setAttribution(null);
        })
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
  }, [query, isEditing]);

  const selectPlace = (place: PlaceResolved) => {
    const geo =
      place.formattedAddress || place.displayName
        ? (place.formattedAddress || place.displayName).slice(0, 255)
        : null;
    onChange(place, geo);
    setQuery('');
    setOpen(false);
    setResults([]);
  };

  const options: Array<{ key: string; place: PlaceResolved; label: string; sub?: string }> = [
    ...results.map((place, i) => ({
      key: place.providerRef ?? `r-${i}`,
      place,
      label: place.displayName,
      sub: place.formattedAddress ?? undefined,
    })),
  ];
  const trimmed = query.trim();
  if (trimmed.length >= MIN_CHARS) {
    options.push({
      key: 'manual',
      place: manualPlace(trimmed),
      label: t('guides.place.useManual', { q: trimmed }),
    });
  }

  const showPopover = isEditing && open && (trimmed.length >= MIN_CHARS || searching);

  if (!isEditing && resolved) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-md border border-border/70 bg-background px-3 py-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{resolved.displayName}</span>
              {resolved.provider === 'manual' && (
                <Badge variant="secondary">{t('guides.place.manualBadge')}</Badge>
              )}
            </div>
            {resolved.formattedAddress && (
              <p className="truncate text-xs text-muted-foreground">{resolved.formattedAddress}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{t('guides.place.resolvedHint')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            disabled={disabled}
            onClick={() => {
              onChange(null, null);
              setQuery('');
              setOpen(true);
            }}
          >
            {t('guides.place.change')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={disabled}
            aria-label={t('guides.place.clear')}
            onClick={() => {
              onChange(null, null);
              setQuery('');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Popover open={showPopover} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            role="combobox"
            aria-expanded={showPopover}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
            value={query}
            disabled={disabled}
            placeholder={t('guides.place.placeholder')}
            className="pl-9"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (!showPopover) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, options.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
                e.preventDefault();
                selectPlace(options[activeIndex].place);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          id={listboxId}
          role="listbox"
          aria-busy={searching}
          className="max-h-64 overflow-auto py-1"
        >
          {searching && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
              role="status"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('guides.place.searching')}
            </div>
          )}
          {!searching && trimmed.length > 0 && trimmed.length < MIN_CHARS && (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t('guides.place.minChars')}</p>
          )}
          {!searching && searchError && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t('guides.place.searchUnavailable')}
            </p>
          )}
          {!searching && !searchError && trimmed.length >= MIN_CHARS && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t('guides.place.noResults', { q: trimmed })}
            </p>
          )}
          {options.map((opt, index) => (
            <button
              key={opt.key}
              id={`${listboxId}-opt-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/80 ${
                index === activeIndex ? 'bg-muted/80' : ''
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectPlace(opt.place)}
            >
              <span className="font-medium">{opt.label}</span>
              {opt.sub && <span className="text-xs text-muted-foreground">{opt.sub}</span>}
            </button>
          ))}
          {attribution && (
            <p className="border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground">
              {attribution}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

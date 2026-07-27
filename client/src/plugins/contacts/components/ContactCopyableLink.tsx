import { Check, Copy } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DETAIL_FIELD_VALUE_CLASS as FIELD_VALUE_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

/** Clickable mailto/tel/website value with a copy button (contacts detail fields). */
export function ContactCopyableLink({
  value,
  href,
  openInNewTab = false,
  className,
}: {
  value: string | null | undefined;
  href?: string;
  openInNewTab?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const trimmed = value?.trim() || '';

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!trimmed) {
    return <div className={cn(FIELD_VALUE_CLASS, className)}>—</div>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className={cn(FIELD_VALUE_CLASS, 'flex min-w-0 items-center gap-1', className)}>
      {href ? (
        <a
          href={href}
          className="min-w-0 truncate text-foreground hover:text-plugin hover:underline"
          {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {trimmed}
        </a>
      ) : (
        <span className="min-w-0 truncate">{trimmed}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 flex-shrink-0 p-0 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        title={t('contacts.quickInfo.copyToClipboard')}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

export function mailtoHref(email: string | null | undefined): string | undefined {
  const trimmed = email?.trim();
  return trimmed ? `mailto:${trimmed}` : undefined;
}

export function telHref(phone: string | null | undefined): string | undefined {
  const trimmed = phone?.trim();
  return trimmed ? `tel:${trimmed.replace(/\s/g, '')}` : undefined;
}

export function websiteHref(website: string | null | undefined): string | undefined {
  const trimmed = website?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

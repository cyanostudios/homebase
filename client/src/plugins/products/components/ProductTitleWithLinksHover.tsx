import React, { useState } from 'react';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { decodeHtmlEntities } from '@/core/utils/decodeHtmlEntities';

import { useProductChannelLinks } from '../hooks/useProductChannelLinks';

export interface ProductTitleWithLinksHoverProps {
  productId: string;
  title: string;
  groupInfo?: { total: number; typeLabel: string };
}

export function ProductTitleWithLinksHover({
  productId,
  title,
  groupInfo,
}: ProductTitleWithLinksHoverProps) {
  const [open, setOpen] = useState(false);
  const { links, loading } = useProductChannelLinks(productId, open);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={300}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-default">
          <div className="font-medium">{decodeHtmlEntities(title)}</div>
          {groupInfo ? (
            <Badge variant="secondary" className="text-xs font-normal shrink-0">
              {groupInfo.total} varianter · {groupInfo.typeLabel}
            </Badge>
          ) : null}
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto min-w-[200px]">
        <div className="space-y-2">
          <div className="text-sm font-medium">Channel links</div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : links.length === 0 ? (
            <div className="text-sm text-muted-foreground">Inga länkar</div>
          ) : (
            <div className="flex flex-col gap-2">
              {links.map((link) => (
                <a
                  key={`${link.channel}-${link.market}-${link.externalId}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80"
                >
                  <span className="capitalize">{link.channel}</span>
                  {link.market && (
                    <span className="text-muted-foreground">
                      ({link.market.toUpperCase()})
                    </span>
                  )}
                  <span className="text-muted-foreground">→</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

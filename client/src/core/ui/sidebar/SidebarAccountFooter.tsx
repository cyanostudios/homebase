// Compact shared-account contact strip for the sidebar footer.

import React, { useMemo } from 'react';

import { useApp } from '@/core/api/AppContext';
import { getSidebarOrganizationLines } from '@/core/api/organizationApi';

export function SidebarAccountFooter() {
  const { organizationProfile } = useApp();

  const lines = useMemo(
    () => getSidebarOrganizationLines(organizationProfile),
    [organizationProfile],
  );

  if (!lines.hasContent) {
    return null;
  }

  return (
    <div className="mt-auto shrink-0 px-6 pb-6 pt-2">
      <div className="space-y-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
        {lines.orgNumber ? <p className="truncate">Org.nr {lines.orgNumber}</p> : null}

        {lines.addressLines.map((line) => (
          <p key={line} className="truncate">
            {line}
          </p>
        ))}

        {lines.websiteHref ? (
          <p className="truncate">
            <a
              href={lines.websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-slate-300/80 underline-offset-2 transition-colors hover:text-slate-600 dark:decoration-slate-600 dark:hover:text-slate-300"
            >
              {lines.websiteLabel}
            </a>
          </p>
        ) : null}

        {lines.email ? (
          <p className="truncate">
            <a
              href={`mailto:${lines.email}`}
              className="underline decoration-slate-300/80 underline-offset-2 transition-colors hover:text-slate-600 dark:decoration-slate-600 dark:hover:text-slate-300"
            >
              {lines.email}
            </a>
          </p>
        ) : null}

        {lines.swish ? <p className="truncate">Swish {lines.swish}</p> : null}
      </div>
    </div>
  );
}

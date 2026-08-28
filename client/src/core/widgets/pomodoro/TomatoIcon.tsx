import type { SVGProps } from 'react';

import { cn } from '@/lib/utils';

/** Pomodoro tomato glyph — uses currentColor so rail button variants control the color. */
export function TomatoIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
      {...props}
    >
      <ellipse cx="12" cy="14.5" rx="7.5" ry="6.5" className="fill-current" />
      <ellipse
        cx="9.25"
        cy="7.25"
        rx="2.4"
        ry="1.35"
        transform="rotate(-38 9.25 7.25)"
        className="fill-current opacity-70"
      />
      <ellipse
        cx="14.75"
        cy="7.25"
        rx="2.4"
        ry="1.35"
        transform="rotate(38 14.75 7.25)"
        className="fill-current opacity-70"
      />
      <ellipse cx="12" cy="6.25" rx="2" ry="1.4" className="fill-current opacity-80" />
    </svg>
  );
}

import { cn } from '@/lib/utils';

type TomatoIconProps = {
  className?: string;
};

/** Pomodoro tomato glyph (Lucide has no tomato icon). */
export function TomatoIcon({ className }: TomatoIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <ellipse cx="12" cy="14.5" rx="7.5" ry="6.5" className="fill-red-500 dark:fill-red-400" />
      {/* Calyx */}
      <ellipse
        cx="9.25"
        cy="7.25"
        rx="2.4"
        ry="1.35"
        transform="rotate(-38 9.25 7.25)"
        className="fill-green-700 dark:fill-green-500"
      />
      <ellipse
        cx="14.75"
        cy="7.25"
        rx="2.4"
        ry="1.35"
        transform="rotate(38 14.75 7.25)"
        className="fill-green-700 dark:fill-green-500"
      />
      <ellipse cx="12" cy="6.25" rx="2" ry="1.4" className="fill-green-600 dark:fill-green-400" />
    </svg>
  );
}

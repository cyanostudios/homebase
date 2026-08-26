import type { AppIcon } from '@/types/icons';
import * as React from 'react';

import { cn } from '@/lib/utils';

export type RoundIconLabelButtonVariant = 'primary' | 'secondary' | 'success' | 'danger';

export interface RoundIconLabelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: AppIcon;
  label: string;
  variant?: RoundIconLabelButtonVariant;
  size?: 'sm' | 'md';
  /** Icon-only until hover when false (Settings / Add). Always shows label when true (Close / Save). */
  alwaysExpanded?: boolean;
  /** When not alwaysExpanded: expand label on hover. Default true; set false for icon-only buttons. */
  expandOnHover?: boolean;
  /** Applied to icon + label (e.g. colored bulk actions on gray pills). */
  contentClassName?: string;
}

const variantClasses: Record<RoundIconLabelButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:brightness-[0.92] dark:hover:brightness-110',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  success:
    'border-none bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700',
  danger:
    'border-none bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700',
};

export function RoundIconLabelButton({
  icon: Icon,
  label,
  variant = 'primary',
  size = 'sm',
  alwaysExpanded = false,
  expandOnHover = true,
  contentClassName,
  className,
  ...props
}: RoundIconLabelButtonProps) {
  const sizeClasses =
    size === 'sm' ? 'h-11 text-sm [&_svg]:size-5' : 'h-12 text-base [&_svg]:size-5';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'group inline-flex items-center overflow-hidden rounded-full',
        'transition-[width,padding,filter] duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        alwaysExpanded
          ? cn('justify-start gap-2 px-3.5 pr-4', sizeClasses)
          : expandOnHover
            ? cn(
                'justify-center',
                sizeClasses,
                'min-w-11 hover:w-auto hover:justify-start hover:pl-3.5 hover:pr-4',
              )
            : cn('justify-center', sizeClasses, 'min-w-11'),
        className,
      )}
      {...props}
    >
      <Icon
        className={cn(
          'shrink-0',
          contentClassName,
          !alwaysExpanded &&
            expandOnHover &&
            'transition-transform duration-200 ease-out group-hover:-translate-x-0.5',
        )}
        aria-hidden
      />
      <span
        className={cn(
          'whitespace-nowrap font-extrabold',
          contentClassName,
          alwaysExpanded
            ? 'min-w-0'
            : expandOnHover
              ? cn(
                  'max-w-0 overflow-hidden opacity-0',
                  'transition-[max-width,opacity,margin] duration-200 ease-out',
                  'group-hover:ml-2 group-hover:max-w-[12rem] group-hover:opacity-100',
                )
              : 'sr-only',
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** @deprecated Use RoundIconLabelButton — pass alwaysExpanded for Add-style always-open labels. */
export function ExpandableIconButton(
  props: Omit<RoundIconLabelButtonProps, 'variant'> &
    Partial<Pick<RoundIconLabelButtonProps, 'variant'>>,
) {
  return (
    <RoundIconLabelButton
      {...props}
      alwaysExpanded={props.alwaysExpanded ?? false}
      variant={props.variant ?? 'primary'}
    />
  );
}

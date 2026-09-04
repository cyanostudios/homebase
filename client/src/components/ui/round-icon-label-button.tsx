import type { AppIcon } from '@/types/icons';
import * as React from 'react';

import { cn } from '@/lib/utils';

export type RoundIconLabelButtonVariant =
  | 'primary'
  | 'soft'
  | 'secondary'
  | 'success'
  | 'successSoft'
  | 'danger'
  | 'dangerSoft';

export type RoundIconLabelButtonSize = 'xs' | 'sm' | 'md';

export interface RoundIconLabelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: AppIcon;
  label: string;
  variant?: RoundIconLabelButtonVariant;
  /**
   * `xs` ≈ 25% smaller than `sm` (compact table / dense actions).
   * `sm` default toolbar control. `md` larger emphasis.
   */
  size?: RoundIconLabelButtonSize;
  /** Icon-only until hover when false (Settings / Add). Always shows label when true (Close / Save). */
  alwaysExpanded?: boolean;
  /** When not alwaysExpanded: expand label on hover. Default true; set false for icon-only buttons. */
  expandOnHover?: boolean;
  /** Applied to icon + label (e.g. colored bulk actions on gray pills). */
  contentClassName?: string;
}

const variantClasses: Record<RoundIconLabelButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:brightness-[0.92] dark:hover:brightness-110',
  /** Idle: light blue like selected filter stats; hover: solid primary. */
  soft: 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground',
  /** Gray pills (bulk / Actions / Export / Close); hover: soft primary chip. */
  secondary: 'bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary',
  success:
    'border-none bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700',
  /** Idle: soft green; hover: solid green. */
  successSoft:
    'bg-green-600/10 text-green-700 hover:bg-green-600 hover:text-white dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white',
  danger:
    'border-none bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700',
  /** Idle: soft primary; hover: solid red. */
  dangerSoft:
    'bg-primary/10 text-primary hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white',
};

/** Height / type / icon — `xs` is ~75% of `sm` (25% smaller). */
const sizeShellClasses: Record<RoundIconLabelButtonSize, string> = {
  xs: 'h-[2.0625rem] min-w-[2.0625rem] text-xs [&_svg]:size-[0.9375rem]',
  sm: 'h-11 min-w-11 text-sm [&_svg]:size-5',
  md: 'h-12 min-w-12 text-base [&_svg]:size-5',
};

const sizeExpandedPadClasses: Record<RoundIconLabelButtonSize, string> = {
  xs: 'gap-1.5 px-2.5 pr-3',
  sm: 'gap-2 px-3.5 pr-4',
  md: 'gap-2 px-3.5 pr-4',
};

const sizeHoverExpandClasses: Record<RoundIconLabelButtonSize, string> = {
  xs: 'hover:pl-2.5 hover:pr-3',
  sm: 'hover:pl-3.5 hover:pr-4',
  md: 'hover:pl-3.5 hover:pr-4',
};

export const RoundIconLabelButton = React.forwardRef<HTMLButtonElement, RoundIconLabelButtonProps>(
  function RoundIconLabelButton(
    {
      icon: Icon,
      label,
      variant = 'primary',
      size = 'sm',
      alwaysExpanded = false,
      expandOnHover = true,
      contentClassName,
      className,
      ...props
    },
    ref,
  ) {
    const shell = sizeShellClasses[size];
    const expandedPad = sizeExpandedPadClasses[size];
    const hoverPad = sizeHoverExpandClasses[size];

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          'group inline-flex items-center overflow-hidden rounded-full',
          'transition-[width,padding,filter,background-color,color] ease-out',
          '[transition-duration:320ms,320ms,320ms,450ms,450ms]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          shell,
          alwaysExpanded
            ? cn('justify-start', expandedPad)
            : expandOnHover
              ? cn('justify-center hover:w-auto hover:justify-start', hoverPad)
              : 'justify-center',
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
              'transition-transform duration-[320ms] ease-out group-hover:-translate-x-0.5',
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
                    'transition-[max-width,opacity,margin] duration-[320ms] ease-out',
                    size === 'xs'
                      ? 'group-hover:ml-1.5 group-hover:max-w-[12rem] group-hover:opacity-100'
                      : 'group-hover:ml-2 group-hover:max-w-[12rem] group-hover:opacity-100',
                  )
                : 'sr-only',
          )}
        >
          {label}
        </span>
      </button>
    );
  },
);
RoundIconLabelButton.displayName = 'RoundIconLabelButton';

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

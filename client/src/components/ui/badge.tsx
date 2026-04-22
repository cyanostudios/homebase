import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold outline-none focus:outline-none focus:ring-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  onClick?: () => void;
  disabled?: boolean;
}

function Badge({ className, variant, onClick, disabled, children, ...props }: BadgeProps) {
  const clickableClasses = onClick
    ? disabled
      ? 'cursor-default opacity-50 transition-opacity'
      : 'cursor-pointer hover:opacity-80 transition-opacity'
    : 'cursor-default';

  if (onClick !== undefined) {
    return (
      <button
        type="button"
        className={cn(badgeVariants({ variant }), clickableClasses, className)}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={cn(badgeVariants({ variant }), clickableClasses, className)} {...props}>
      {children}
    </div>
  );
}

export { Badge, badgeVariants };

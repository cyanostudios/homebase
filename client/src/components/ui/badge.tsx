import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  onClick?: () => void; // Support onClick for backward compatibility
  disabled?: boolean; // Support disabled for backward compatibility
}

function Badge({ className, variant, onClick, disabled, children, ...props }: BadgeProps) {
  const Component = onClick ? 'button' : 'div';
  
  // Only add hover states, transition, and cursor-pointer when onClick is provided
  // Non-clickable badges should not have any hover states or transitions
  const clickableClasses = onClick
    ? disabled
      ? 'cursor-default opacity-50 transition-opacity'
      : 'cursor-pointer hover:opacity-80 transition-opacity'
    : 'cursor-default'; // Non-clickable badges: no hover states, no transitions

  return (
    <Component
      className={cn(badgeVariants({ variant }), clickableClasses, className)}
      onClick={onClick && !disabled ? onClick : undefined}
      disabled={disabled}
      {...props}
    >
      {children}
    </Component>
  )
}

export { Badge, badgeVariants }

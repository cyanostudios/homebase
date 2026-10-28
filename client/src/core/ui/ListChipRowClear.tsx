import { X } from 'lucide-react';
import React from 'react';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { cn } from '@/lib/utils';

type ListChipRowClearProps = {
  /** When false, render nothing. */
  visible: boolean;
  ariaLabel: string;
  onClear: () => void;
  className?: string;
};

/**
 * Trailing clear control for list filter/tag chip rows.
 * White shell + red X (same small round-button language as other toolbar clears).
 */
export function ListChipRowClear({
  visible,
  ariaLabel,
  onClear,
  className,
}: ListChipRowClearProps) {
  if (!visible) {
    return null;
  }

  return (
    <RoundIconLabelButton
      type="button"
      icon={X}
      label={ariaLabel}
      size="xs"
      expandOnHover={false}
      variant="secondary"
      className={cn(
        'shrink-0 bg-white text-red-600 shadow-sm hover:bg-red-600 hover:text-white dark:bg-white dark:text-red-600 dark:hover:bg-red-600 dark:hover:text-white',
        className,
      )}
      contentClassName="text-red-600 group-hover:text-white dark:text-red-600 dark:group-hover:text-white"
      onClick={onClear}
    />
  );
}

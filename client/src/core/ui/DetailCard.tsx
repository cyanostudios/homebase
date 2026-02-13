import React from 'react';
import { cn } from '@/lib/utils';

interface DetailCardProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'blue' | 'green' | 'yellow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export function DetailCard({
  children,
  variant = 'neutral',
  padding = 'md',
  className,
  onClick,
}: DetailCardProps) {
  const variants = {
    neutral: 'bg-gray-50/50 border-gray-100 dark:bg-gray-900/50 dark:border-gray-800',
    blue: 'bg-blue-50/40 border-blue-100 dark:bg-blue-900/30 dark:border-blue-800/50',
    green: 'bg-green-50/40 border-green-100 dark:bg-green-900/30 dark:border-green-800/50',
    yellow: 'bg-yellow-50/40 border-yellow-100 dark:bg-yellow-900/30 dark:border-yellow-800/50',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={cn(
        'rounded-xl border transition-all duration-200',
        onClick && 'hover:shadow-md cursor-pointer text-left w-full',
        variants[variant],
        paddings[padding],
        className,
      )}
    >
      {children}
    </Component>
  );
}

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function Badge({ children, className = '', onClick, disabled = false }: BadgeProps) {
  const baseClasses =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border font-normal';

  const clickableClasses = onClick
    ? disabled
      ? 'cursor-default'
      : 'cursor-pointer hover:bg-gray-50'
    : '';

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      className={`${baseClasses} ${clickableClasses} ${className}`}
      onClick={onClick && !disabled ? onClick : undefined}
      disabled={disabled}
    >
      {children}
    </Component>
  );
}

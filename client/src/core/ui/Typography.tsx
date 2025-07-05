import React from 'react';

interface HeadingProps {
  level: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}

export function Heading({ level, className = '', children }: HeadingProps) {
  const levelStyles = {
    1: "text-2xl font-bold text-gray-900",
    2: "text-lg font-semibold text-gray-900",
    3: "text-base font-semibold text-gray-900",
    4: "text-sm font-semibold text-gray-900",
  };

  const Component = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <Component className={`${levelStyles[level]} ${className}`}>
      {children}
    </Component>
  );
}

interface TextProps {
  variant?: 'body' | 'caption' | 'muted';
  className?: string;
  children: React.ReactNode;
}

export function Text({ variant = 'body', className = '', children }: TextProps) {
  const variantStyles = {
    body: "text-gray-900",
    caption: "text-gray-600",
    muted: "text-sm text-gray-500",
  };

  return (
    <p className={`${variantStyles[variant]} ${className}`}>
      {children}
    </p>
  );
} 
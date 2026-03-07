import React from 'react';

interface HeadingProps {
  level: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
  color?: 'gray-900' | 'gray-600' | 'gray-500' | 'blue-600' | 'red-600';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export function Heading({
  level,
  className = '',
  children,
  color = 'gray-900',
  size,
  fontWeight = 'semibold',
}: HeadingProps) {
  const defaultLevelSizes = {
    1: 'text-2xl',
    2: 'text-lg',
    3: 'text-base',
    4: 'text-sm',
  };

  const defaultLevelWeights = {
    1: 'font-bold',
    2: 'font-semibold',
    3: 'font-semibold',
    4: 'font-semibold',
  };

  // Build classes based on props or defaults
  const sizeClass = size ? `text-${size}` : defaultLevelSizes[level];
  const weightClass =
    fontWeight === 'semibold' && !size ? defaultLevelWeights[level] : `font-${fontWeight}`;
  // Map colors to design tokens
  const colorMap: Record<string, string> = {
    'gray-900': 'text-foreground',
    'gray-600': 'text-muted-foreground',
    'gray-500': 'text-muted-foreground',
    'blue-600': 'text-primary',
    'red-600': 'text-destructive',
  };
  const colorClass = colorMap[color] || 'text-foreground';

  const Component = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <Component className={`${sizeClass} ${weightClass} ${colorClass} ${className}`}>
      {children}
    </Component>
  );
}

interface TextProps {
  variant?: 'body' | 'caption' | 'muted';
  className?: string;
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  color?: 'gray-900' | 'gray-600' | 'gray-500' | 'blue-600' | 'red-600';
  element?: 'p' | 'span' | 'div';
}

export function Text({
  variant = 'body',
  className = '',
  children,
  size,
  color,
  element = 'p',
}: TextProps) {
  const variantStyles = {
    body: 'text-foreground',
    caption: 'text-muted-foreground',
    muted: 'text-sm text-muted-foreground',
  };

  // If size or color is provided, build custom classes
  let customClasses = '';
  if (size || color) {
    const sizeClass = size ? `text-${size}` : '';
    const colorMap: Record<string, string> = {
      'gray-900': 'text-foreground',
      'gray-600': 'text-muted-foreground',
      'gray-500': 'text-muted-foreground',
      'blue-600': 'text-primary',
      'red-600': 'text-destructive',
    };
    const colorClass = color ? colorMap[color] || 'text-foreground' : 'text-foreground';
    customClasses = `${sizeClass} ${colorClass}`.trim();
  }

  const Component = element;

  return (
    <Component className={`${customClasses || variantStyles[variant]} ${className}`}>
      {children}
    </Component>
  );
}

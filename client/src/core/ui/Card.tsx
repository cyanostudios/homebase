import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className = '',
  padding = 'none',
}: CardProps) {
  const baseStyles = "bg-white rounded-lg shadow-sm";
  
  const paddingStyles = {
    none: "",
    sm: "p-3",
    md: "p-4", 
    lg: "p-6",
  };

  const combinedStyles = `${baseStyles} ${paddingStyles[padding]} ${className}`;

  return (
    <div className={combinedStyles}>
      {children}
    </div>
  );
}

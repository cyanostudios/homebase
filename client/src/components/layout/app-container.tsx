
import React from "react";

interface AppContainerProps {
  children: React.ReactNode;
  title?: string;
  actionButton?: React.ReactNode;
}

export function AppContainer({ children, title, actionButton }: AppContainerProps) {
  return (
    <div className="w-full space-y-6">
      {(title || actionButton) && (
        <div className="flex items-center justify-between">
          {title && <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>}
          {actionButton && (
            <div className="flex items-center gap-4">
              {actionButton}
            </div>
          )}
        </div>
      )}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}

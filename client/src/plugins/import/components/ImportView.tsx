import React from 'react';

interface ImportViewProps {
  item?: any;
}

export function ImportView({ item }: ImportViewProps) {
  return (
    <div className="p-4">
      <div className="text-gray-500 text-center">
        Import operation details would be displayed here
      </div>
    </div>
  );
}
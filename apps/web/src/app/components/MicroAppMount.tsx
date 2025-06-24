import React from 'react';

export interface MicroAppMountProps {
  name: string;
}

export const MicroAppMount: React.FC<MicroAppMountProps> = ({ name }) => {
  return (
    <div className="border rounded p-4 bg-gray-50">
      Micro app "{name}" would mount here.
    </div>
  );
};

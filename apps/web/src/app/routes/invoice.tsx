import React from 'react';
import { MicroAppMount } from '../components/MicroAppMount';

const Invoice: React.FC = () => {
  return (
    <div>
      <h1 className="text-xl mb-4">Invoice</h1>
      <MicroAppMount name="invoice" />
    </div>
  );
};

export default Invoice;

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  const inputClasses = "w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  
  if (label) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input className={`${inputClasses} ${className}`} {...props} />
      </div>
    );
  }
  
  return <input className={`${inputClasses} ${className}`} {...props} />;
};

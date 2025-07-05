import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';

interface ContactFormProps {
 onSave: (data: any) => void;
 onCancel: () => void;
 isSubmitting?: boolean;
}

export const ContactForm: React.FC<ContactFormProps> = ({ onSave, onCancel, isSubmitting = false }) => {
 const [formData, setFormData] = useState({
   companyName: '',
   email: '',
   phone: ''
 });

 const handleSubmit = (e: React.FormEvent) => {
   e.preventDefault();
   onSave(formData);
 };

 return (
   <div className="p-6">
     <form onSubmit={handleSubmit} className="space-y-6">
       <Card padding="md">
         <Heading level={3} className="mb-4">Basic Information</Heading>
         
         <div className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">
               Company Name
             </label>
             <input
               type="text"
               value={formData.companyName}
               onChange={(e) => setFormData({...formData, companyName: e.target.value})}
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
               required
             />
           </div>
           
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">
               Email
             </label>
             <input
               type="email"
               value={formData.email}
               onChange={(e) => setFormData({...formData, email: e.target.value})}
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
             />
           </div>
           
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">
               Phone
             </label>
             <input
               type="tel"
               value={formData.phone}
               onChange={(e) => setFormData({...formData, phone: e.target.value})}
               className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
             />
           </div>
         </div>
       </Card>

       <div className="flex justify-end space-x-3">
         <Button
           type="button"
           onClick={onCancel}
           disabled={isSubmitting}
           variant="danger"
           icon={X}
         >
           Cancel
         </Button>
         <Button
           type="submit"
           disabled={isSubmitting}
           variant="primary"
           icon={Check}
         >
           {isSubmitting ? 'Saving...' : 'Save Contact'}
         </Button>
       </div>
     </form>
   </div>
 );
};

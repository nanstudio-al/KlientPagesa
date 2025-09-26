import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClientForm } from '../ClientForm';

export default function ClientFormExample() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (data: any) => {
    console.log('Client form submitted:', data);
  };

  return (
    <div className="p-4 space-y-4">
      <Button onClick={() => setIsOpen(true)}>Open Client Form</Button>
      <ClientForm 
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
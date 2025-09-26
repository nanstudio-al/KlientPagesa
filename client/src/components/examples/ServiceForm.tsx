import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ServiceForm } from '../ServiceForm';

export default function ServiceFormExample() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (data: any) => {
    console.log('Service form submitted:', data);
  };

  return (
    <div className="p-4 space-y-4">
      <Button onClick={() => setIsOpen(true)}>Open Service Form</Button>
      <ServiceForm 
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
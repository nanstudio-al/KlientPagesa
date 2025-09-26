import { ServiceCard } from '../ServiceCard';

export default function ServiceCardExample() {
  //todo: remove mock functionality
  const mockService = {
    id: '1',
    name: 'Hostim Web',
    description: 'Hostim i plotë për faqe interneti me SSL dhe backup automatik',
    price: '200.00',
    billingPeriod: 'yearly',
    createdAt: new Date(),
  };

  const handleEdit = () => {
    console.log('Edit service triggered');
  };

  const handleDelete = () => {
    console.log('Delete service triggered');
  };

  return (
    <div className="p-4 max-w-md">
      <ServiceCard 
        service={mockService} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
      />
    </div>
  );
}
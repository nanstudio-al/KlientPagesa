import { ClientCard } from '../ClientCard';

export default function ClientCardExample() {
  //todo: remove mock functionality
  const mockClient = {
    id: '1',
    name: 'Alfa Shpk',
    email: 'info@alfashpk.al',
    phone: '+355 69 123 4567',
    address: 'Rruga e Durrësit 10, Tiranë',
    taxId: 'K12345678A',
    isCompany: 1,
    createdAt: new Date(),
    services: ['Hostim', 'Email', 'Support'],
    totalPending: 250,
    overdueCount: 1,
  };

  const handleView = () => {
    console.log('View client details triggered');
  };

  return (
    <div className="p-4 max-w-md">
      <ClientCard client={mockClient} onView={handleView} />
    </div>
  );
}
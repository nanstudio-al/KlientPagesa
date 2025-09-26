import { InvoiceCard } from '../InvoiceCard';

export default function InvoiceCardExample() {
  //todo: remove mock functionality
  const mockInvoice = {
    id: '1',
    clientId: '1',
    serviceId: '1',
    amount: '200.00',
    issueDate: new Date('2024-05-01'),
    dueDate: new Date('2024-06-15'),
    status: 'pending' as const,
    paidDate: null,
    clientName: 'Alfa Shpk',
    serviceName: 'Hostim Web',
  };

  const handleMarkPaid = () => {
    console.log('Mark as paid triggered');
  };

  const handleSendEmail = () => {
    console.log('Send email triggered');
  };

  const handleDownload = () => {
    console.log('Download invoice triggered');
  };

  return (
    <div className="p-4 max-w-md">
      <InvoiceCard 
        invoice={mockInvoice} 
        onMarkPaid={handleMarkPaid}
        onSendEmail={handleSendEmail}
        onDownload={handleDownload}
      />
    </div>
  );
}
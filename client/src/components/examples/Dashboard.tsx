import { Dashboard } from '../Dashboard';

export default function DashboardExample() {
  //todo: remove mock functionality
  const mockStats = {
    totalClients: 24,
    activeServices: 5,
    pendingInvoices: 8,
    overdueInvoices: 2,
    monthlyRevenue: 4250,
    pendingAmount: 1350,
  };

  const mockRecentInvoices = [
    {
      id: '1',
      clientName: 'Alfa Shpk',
      serviceName: 'Hostim Web',
      amount: '200.00',
      dueDate: new Date('2024-06-15'),
      status: 'pending' as const,
    },
    {
      id: '2',
      clientName: 'Beta Solutions',
      serviceName: 'Support Teknik',
      amount: '150.00',
      dueDate: new Date('2024-05-30'),
      status: 'overdue' as const,
    },
    {
      id: '3',
      clientName: 'Gamma LLC',
      serviceName: 'Email Service',
      amount: '50.00',
      dueDate: new Date('2024-06-01'),
      status: 'paid' as const,
    },
  ];

  const mockUpcomingPayments = [
    {
      id: '1',
      clientName: 'Delta Corp',
      serviceName: 'Hostim Web',
      amount: '200.00',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
    {
      id: '2',
      clientName: 'Epsilon Ltd',
      serviceName: 'Domain Registration',
      amount: '25.00',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    },
  ];

  const handleCreateClient = () => {
    console.log('Create client triggered');
  };

  const handleCreateInvoice = () => {
    console.log('Create invoice triggered');
  };

  return (
    <div className="p-6">
      <Dashboard 
        stats={mockStats}
        recentInvoices={mockRecentInvoices}
        upcomingPayments={mockUpcomingPayments}
        onCreateClient={handleCreateClient}
        onCreateInvoice={handleCreateInvoice}
      />
    </div>
  );
}
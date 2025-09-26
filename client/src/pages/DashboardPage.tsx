import { useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { ClientForm } from "@/components/ClientForm";

export default function DashboardPage() {
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  
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
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: '2',
      clientName: 'Epsilon Ltd',
      serviceName: 'Domain Registration',
      amount: '25.00',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
  ];

  const handleCreateClient = () => {
    setIsClientFormOpen(true);
  };

  const handleCreateInvoice = () => {
    console.log('Create invoice triggered');
  };

  const handleClientSubmit = (data: any) => {
    console.log('Client created:', data);
  };

  return (
    <div data-testid="page-dashboard">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Përmbledhja e përgjithshme e aktivitetit</p>
      </div>
      
      <Dashboard 
        stats={mockStats}
        recentInvoices={mockRecentInvoices}
        upcomingPayments={mockUpcomingPayments}
        onCreateClient={handleCreateClient}
        onCreateInvoice={handleCreateInvoice}
      />

      <ClientForm 
        isOpen={isClientFormOpen}
        onOpenChange={setIsClientFormOpen}
        onSubmit={handleClientSubmit}
      />
    </div>
  );
}
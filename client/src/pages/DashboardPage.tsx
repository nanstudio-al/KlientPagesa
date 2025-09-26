import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dashboard } from "@/components/Dashboard";
import { ClientForm } from "@/components/ClientForm";
import { InvoiceForm } from "@/components/InvoiceForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { InsertClient, InsertInvoice } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    enabled: true
  });

  const { data: recentInvoices, isLoading: recentLoading, error: recentError } = useQuery({
    queryKey: ['/api/dashboard/recent-invoices'],
    enabled: true
  });

  const { data: upcomingPayments, isLoading: upcomingLoading, error: upcomingError } = useQuery({
    queryKey: ['/api/dashboard/upcoming-payments'],
    enabled: true
  });

  const createClientMutation = useMutation({
    mutationFn: (data: InsertClient) => apiRequest('POST', '/api/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Klienti u krijua me sukses!" });
    },
    onError: () => {
      toast({ title: "Gabim në krijimin e klientit", variant: "destructive" });
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: InsertInvoice) => apiRequest('POST', '/api/invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/monthly-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/top-services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/overdue-payments'] });
      toast({ title: "Fatura u krijua me sukses!" });
    },
    onError: () => {
      toast({ title: "Gabim në krijimin e faturës", variant: "destructive" });
    }
  });

  const handleCreateClient = () => {
    setIsClientFormOpen(true);
  };

  const handleCreateInvoice = () => {
    setIsInvoiceFormOpen(true);
  };

  const handleClientSubmit = (data: InsertClient) => {
    createClientMutation.mutate(data);
  };

  const handleInvoiceSubmit = (data: InsertInvoice) => {
    createInvoiceMutation.mutate(data);
  };

  const hasErrors = statsError || recentError || upcomingError;
  const isLoading = statsLoading || recentLoading || upcomingLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Duke ngarkuar...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-dashboard">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Përmbledhja e përgjithshme e aktivitetit</p>
      </div>
      
      {hasErrors && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Gabim në ngarkimin e të dhënave. Disa statistika mund të mos jenë të azhurnuara.
          </AlertDescription>
        </Alert>
      )}
      
      <Dashboard 
        stats={stats as any || {
          totalClients: 0,
          activeServices: 0,
          pendingInvoices: 0,
          overdueInvoices: 0,
          monthlyRevenue: 0,
          pendingAmount: 0
        }}
        recentInvoices={(recentInvoices as any) || []}
        upcomingPayments={(upcomingPayments as any) || []}
        onCreateClient={handleCreateClient}
        onCreateInvoice={handleCreateInvoice}
      />

      <ClientForm 
        isOpen={isClientFormOpen}
        onOpenChange={setIsClientFormOpen}
        onSubmit={handleClientSubmit}
      />
      
      <InvoiceForm 
        isOpen={isInvoiceFormOpen}
        onOpenChange={setIsInvoiceFormOpen}
        onSubmit={handleInvoiceSubmit}
      />
    </div>
  );
}
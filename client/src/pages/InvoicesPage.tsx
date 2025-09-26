import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceCard } from "@/components/InvoiceCard";
import { InvoiceForm } from "@/components/InvoiceForm";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Filter, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { InsertInvoice } from "@shared/schema";

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const { toast } = useToast();

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['/api/invoices'],
    enabled: true
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

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => apiRequest('PATCH', `/api/invoices/${invoiceId}/status`, {
      status: 'paid',
      paidDate: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/monthly-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/top-services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/overdue-payments'] });
      toast({ title: "Fatura u shënua si e paguar!" });
    },
    onError: () => {
      toast({ title: "Gabim në përditisimin e faturës", variant: "destructive" });
    }
  });

  const filteredInvoices = (invoices as any[]).filter((invoice: any) => {
    const matchesSearch = invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateInvoice = () => {
    setIsInvoiceFormOpen(true);
  };

  const handleInvoiceSubmit = (data: InsertInvoice) => {
    createInvoiceMutation.mutate(data);
  };

  const handleMarkPaid = (invoiceId: string) => {
    markPaidMutation.mutate(invoiceId);
  };

  const handleSendEmail = (invoiceId: string) => {
    console.log('Send invoice email:', invoiceId);
  };

  const handleDownload = (invoiceId: string) => {
    console.log('Download invoice:', invoiceId);
  };

  const getStatusCount = (status: string) => {
    if (status === "all") return (invoices as any[]).length;
    return (invoices as any[]).filter((inv: any) => inv.status === status).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Duke ngarkuar faturat...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-invoices">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Faturat</h1>
            <p className="text-muted-foreground">Menaxho faturat dhe pagesat</p>
          </div>
          <Button onClick={handleCreateInvoice} data-testid="button-new-invoice">
            <Plus className="w-4 h-4 mr-2" />
            Faturë e re
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kërko fatura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
            data-testid="input-search-invoices"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Të gjitha ({getStatusCount("all")})</SelectItem>
            <SelectItem value="paid">Paguar ({getStatusCount("paid")})</SelectItem>
            <SelectItem value="pending">Në pritje ({getStatusCount("pending")})</SelectItem>
            <SelectItem value="overdue">Vonesa ({getStatusCount("overdue")})</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <StatusBadge status="paid" />
          <StatusBadge status="pending" />
          <StatusBadge status="overdue" />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Gabim në ngarkimin e faturave. Provoni përsëri.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInvoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            onMarkPaid={() => handleMarkPaid(invoice.id)}
            onSendEmail={() => handleSendEmail(invoice.id)}
            onDownload={() => handleDownload(invoice.id)}
          />
        ))}
      </div>

      {filteredInvoices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nuk u gjetën fatura</p>
          {(searchTerm || statusFilter !== "all") && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }} 
              className="mt-4"
              data-testid="button-clear-filters"
            >
              Pastro filtrat
            </Button>
          )}
        </div>
      )}

      <InvoiceForm 
        isOpen={isInvoiceFormOpen}
        onOpenChange={setIsInvoiceFormOpen}
        onSubmit={handleInvoiceSubmit}
      />
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceCard } from "@/components/InvoiceCard";
import { InvoiceForm } from "@/components/InvoiceForm";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Filter, AlertCircle, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { InsertInvoice } from "@shared/schema";
import { format } from "date-fns";
import { sq } from "date-fns/locale"; // Albanian locale for date-fns

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<{from?: Date; to?: Date}>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const itemsPerPage = 10;
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
    
    // Date filtering
    let matchesDate = true;
    if (dateFilter.from || dateFilter.to) {
      const invoiceDate = new Date(invoice.issueDate);
      if (dateFilter.from && invoiceDate < dateFilter.from) {
        matchesDate = false;
      }
      if (dateFilter.to && invoiceDate > dateFilter.to) {
        matchesDate = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvoices = filteredInvoices.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleDateChange = (range: {from?: Date; to?: Date}) => {
    setDateFilter(range);
    setCurrentPage(1);
  };

  const handleCreateInvoice = () => {
    setIsInvoiceFormOpen(true);
  };

  const handleInvoiceSubmit = (data: InsertInvoice) => {
    createInvoiceMutation.mutate(data);
  };

  const handleMarkPaid = (invoiceId: string) => {
    markPaidMutation.mutate(invoiceId);
  };

  const sendEmailMutation = useMutation({
    mutationFn: (invoiceId: string) => apiRequest('POST', `/api/invoices/${invoiceId}/send-email`),
    onSuccess: (data: any) => {
      toast({ 
        title: "Email u dërgua me sukses!", 
        description: `Fatura u dërgua në: ${data.recipient}` 
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || "Gabim në dërgimin e email-it";
      toast({ 
        title: "Gabim në dërgimin e email-it", 
        description: message,
        variant: "destructive" 
      });
    }
  });

  const handleSendEmail = (invoiceId: string) => {
    sendEmailMutation.mutate(invoiceId);
  };

  const handleDownload = (invoiceId: string) => {
    // Create a temporary link to download the invoice
    const link = document.createElement('a');
    link.href = `/api/invoices/${invoiceId}/download`;
    link.download = `fatura-${invoiceId.slice(-8)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ 
      title: "Fatura po shkarkohet", 
      description: "Fatura është gjeneruar dhe po shkarkohet automatikisht." 
    });
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 w-64"
            data-testid="input-search-invoices"
          />
        </div>

        <Select value={statusFilter} onValueChange={handleStatusChange}>
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

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
              <Calendar className="mr-2 h-4 w-4" />
              {dateFilter.from ? (
                dateFilter.to ? (
                  `${format(dateFilter.from, "dd/MM/yyyy")} - ${format(dateFilter.to, "dd/MM/yyyy")}`
                ) : (
                  format(dateFilter.from, "dd/MM/yyyy")
                )
              ) : (
                "Filtro sipas datës"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{
                from: dateFilter.from,
                to: dateFilter.to
              }}
              onSelect={(range) => handleDateChange(range || {})}
              initialFocus
            />
            <div className="p-3 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDateChange({})}
              >
                Pastro filtrin e datës
              </Button>
            </div>
          </PopoverContent>
        </Popover>

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
        {currentInvoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            onMarkPaid={() => handleMarkPaid(invoice.id)}
            onSendEmail={() => handleSendEmail(invoice.id)}
            onDownload={() => handleDownload(invoice.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
            Mbrapa
          </Button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                data-testid={`button-page-${page}`}
              >
                {page}
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            data-testid="button-next-page"
          >
            Para
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {currentInvoices.length === 0 && filteredInvoices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nuk u gjetën fatura</p>
          {(searchTerm || statusFilter !== "all" || dateFilter.from || dateFilter.to) && (
            <Button 
              variant="outline" 
              onClick={() => {
                handleSearchChange("");
                handleStatusChange("all");
                handleDateChange({});
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
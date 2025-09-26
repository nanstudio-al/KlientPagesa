import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceCard } from "@/components/InvoiceCard";
import { InvoiceForm } from "@/components/InvoiceForm";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Filter, AlertCircle, ChevronLeft, ChevronRight, Calendar, FileText } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [emailConfirmDialog, setEmailConfirmDialog] = useState<{open: boolean; invoiceId?: string; clientEmail?: string}>({open: false});
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
    // Search across client name and all services
    let matchesSearch = invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Also search in services (new structure) or serviceName (legacy fallback)
    if (!matchesSearch) {
      if (invoice.services && invoice.services.length > 0) {
        // Search across all services in the invoice
        matchesSearch = invoice.services.some((service: any) => 
          service.service.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else if (invoice.serviceName) {
        // Fallback to legacy serviceName field
        matchesSearch = invoice.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
      }
    }
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
    // Find the invoice to get client email
    const invoice = (invoices as any[]).find((inv: any) => inv.id === invoiceId);
    const clientEmail = invoice?.clientEmail || "klienti";
    
    setEmailConfirmDialog({
      open: true,
      invoiceId,
      clientEmail
    });
  };

  const confirmSendEmail = () => {
    if (emailConfirmDialog.invoiceId) {
      sendEmailMutation.mutate(emailConfirmDialog.invoiceId);
      setEmailConfirmDialog({open: false});
    }
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
    <div className="container mx-auto px-4 py-6" data-testid="page-invoices">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Faturat</h1>
            <p className="text-sm text-muted-foreground">Menaxho faturat dhe pagesat e kompanisë</p>
          </div>
          <Button 
            onClick={handleCreateInvoice} 
            className="self-start sm:self-auto"
            size="default"
            data-testid="button-new-invoice"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Faturë e re</span>
            <span className="sm:hidden">E re</span>
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="mb-8">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Kërko fatura, klienët, shërbimet..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1"
              data-testid="input-search-invoices"
            />
          </div>
          
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-44 h-9" data-testid="select-status-filter">
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
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto h-9 justify-start font-normal text-sm"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span className="truncate">
                    {dateFilter.from ? (
                      dateFilter.to ? (
                        `${format(dateFilter.from, "dd/MM")} - ${format(dateFilter.to, "dd/MM")}`
                      ) : (
                        format(dateFilter.from, "dd/MM/yyyy")
                      )
                    ) : (
                      "Filtro sipas datës"
                    )}
                  </span>
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
                    Pastro filtrin
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Status Legend */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="paid" />
            <StatusBadge status="pending" />
            <StatusBadge status="overdue" />
          </div>
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

      {/* Invoices Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 pt-6 border-t">
          {/* Mobile pagination info */}
          <div className="text-sm text-muted-foreground order-2 sm:order-1">
            Faqja {currentPage} nga {totalPages} ({filteredInvoices.length} fatura)
          </div>
          
          {/* Pagination controls */}
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-8"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Mbrapa</span>
            </Button>
            
            {/* Page numbers - adaptive for mobile */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8 h-8 p-0"
                    data-testid={`button-page-${page}`}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="h-8"
              data-testid="button-next-page"
            >
              <span className="hidden sm:inline mr-1">Para</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {currentInvoices.length === 0 && filteredInvoices.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nuk u gjetën fatura</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {(searchTerm || statusFilter !== "all" || dateFilter.from || dateFilter.to) 
                ? "Nuk ka fatura që përputhen me filtrat e zgjedhura."
                : "Krijo faturën e parë për të filluar."
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {(searchTerm || statusFilter !== "all" || dateFilter.from || dateFilter.to) && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleSearchChange("");
                    handleStatusChange("all");
                    handleDateChange({});
                  }} 
                  data-testid="button-clear-filters"
                >
                  Pastro filtrat
                </Button>
              )}
              <Button
                onClick={handleCreateInvoice}
                data-testid="button-create-first-invoice"
              >
                <Plus className="w-4 h-4 mr-2" />
                Krijo faturën e parë
              </Button>
            </div>
          </div>
        </div>
      )}

      <InvoiceForm 
        isOpen={isInvoiceFormOpen}
        onOpenChange={setIsInvoiceFormOpen}
        onSubmit={handleInvoiceSubmit}
      />

      <AlertDialog open={emailConfirmDialog.open} onOpenChange={(open) => setEmailConfirmDialog({open})}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dërgo Email</AlertDialogTitle>
            <AlertDialogDescription>
              A jeni i sigurt që dëshironi të dërgoni email për këtë faturë në: <strong>{emailConfirmDialog.clientEmail}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-email">Anulo</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmSendEmail}
              disabled={sendEmailMutation.isPending}
              data-testid="button-confirm-email"
            >
              {sendEmailMutation.isPending ? "Duke dërguar..." : "Dërgo Email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
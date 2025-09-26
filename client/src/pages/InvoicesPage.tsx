import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceCard } from "@/components/InvoiceCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  //todo: remove mock functionality
  const mockInvoices = [
    {
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
    },
    {
      id: '2',
      clientId: '2',
      serviceId: '2',
      amount: '50.00',
      issueDate: new Date('2024-05-15'),
      dueDate: new Date('2024-05-30'),
      status: 'overdue' as const,
      paidDate: null,
      clientName: 'Beta Solutions',
      serviceName: 'Email Business',
    },
    {
      id: '3',
      clientId: '3',
      serviceId: '1',
      amount: '200.00',
      issueDate: new Date('2024-04-01'),
      dueDate: new Date('2024-05-01'),
      status: 'paid' as const,
      paidDate: new Date('2024-04-28'),
      clientName: 'Tech Solutions Ltd',
      serviceName: 'Hostim Web',
    },
  ];

  const filteredInvoices = mockInvoices.filter(invoice => {
    const matchesSearch = invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMarkPaid = (invoiceId: string) => {
    console.log('Mark invoice as paid:', invoiceId);
  };

  const handleSendEmail = (invoiceId: string) => {
    console.log('Send invoice email:', invoiceId);
  };

  const handleDownload = (invoiceId: string) => {
    console.log('Download invoice:', invoiceId);
  };

  const getStatusCount = (status: string) => {
    if (status === "all") return mockInvoices.length;
    return mockInvoices.filter(inv => inv.status === status).length;
  };

  return (
    <div data-testid="page-invoices">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Faturat</h1>
            <p className="text-muted-foreground">Menaxho faturat dhe pagesat</p>
          </div>
          <Button data-testid="button-new-invoice">
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
    </div>
  );
}
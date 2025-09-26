import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { FileText, DollarSign, Download, Mail, Package } from "lucide-react";
import type { InvoiceWithServices } from "@shared/schema";

interface InvoiceCardProps {
  invoice: InvoiceWithServices & {
    clientName: string;
    serviceName?: string; // Legacy field for backward compatibility
  };
  onMarkPaid: () => void;
  onSendEmail: () => void;
  onDownload: () => void;
}

export function InvoiceCard({ invoice, onMarkPaid, onSendEmail, onDownload }: InvoiceCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('sq-AL');
  };

  const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid';

  // Helper function to get services summary
  const getServicesDisplay = () => {
    if (invoice.services && invoice.services.length > 0) {
      if (invoice.services.length === 1) {
        const service = invoice.services[0];
        return service.quantity > 1 
          ? `${service.service.name} (${service.quantity}x)`
          : service.service.name;
      } else {
        return `${invoice.services.length} shërbime të ndryshme`;
      }
    }
    // Fallback to legacy serviceName for backward compatibility
    return invoice.serviceName || "N/A";
  };

  // Get the total amount
  const getTotalAmount = () => {
    return invoice.totalAmount || "0";
  };

  return (
    <Card className="hover-elevate transition-all duration-200 border-0 shadow-sm bg-card/50 backdrop-blur-sm" data-testid={`card-invoice-${invoice.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-primary/10">
                <FileText className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="font-semibold text-base truncate" data-testid={`text-invoice-client-${invoice.id}`}>
                {invoice.clientName}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Package className="w-3 h-3" />
              <span className="truncate" data-testid={`text-invoice-service-${invoice.id}`}>
                {getServicesDisplay()}
              </span>
            </div>
          </div>
          <StatusBadge status={isOverdue ? 'overdue' : invoice.status} />
        </div>
        
        {/* Amount display - more prominent */}
        <div className="mt-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Totali</span>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xl font-bold text-foreground" data-testid={`text-invoice-amount-${invoice.id}`}>
                {getTotalAmount()}€
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        {/* Show detailed services breakdown if multiple services */}
        {invoice.services && invoice.services.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Shërbimet</p>
            <div className="space-y-1.5">
              {invoice.services.map((service, index) => (
                <div key={`${service.serviceId}-${index}`} className="flex justify-between items-center py-1 text-sm">
                  <span className="flex-1 truncate">{service.service.name}</span>
                  <span className="font-medium text-muted-foreground ml-2">
                    {service.quantity}x {service.unitPrice}€
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date information */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Lëshuar</span>
              <span className="font-medium" data-testid={`text-invoice-issue-date-${invoice.id}`}>
                {formatDate(invoice.issueDate)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Skadenca</span>
              <span 
                className={`font-medium ${
                  isOverdue ? 'text-destructive' : 'text-foreground'
                }`}
                data-testid={`text-invoice-due-date-${invoice.id}`}
              >
                {formatDate(invoice.dueDate)}
              </span>
            </div>
            {invoice.paidDate && (
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Paguar</span>
                <span className="font-medium text-chart-2" data-testid={`text-invoice-paid-date-${invoice.id}`}>
                  {formatDate(invoice.paidDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          {invoice.status !== 'paid' && (
            <Button 
              onClick={onMarkPaid}
              variant="default" 
              size="sm"
              className="flex-1 h-9"
              data-testid={`button-mark-paid-${invoice.id}`}
            >
              <span className="hidden sm:inline">Shëno si të paguar</span>
              <span className="sm:hidden">Paguar</span>
            </Button>
          )}
          <div className="flex gap-2 sm:flex-shrink-0">
            <Button 
              onClick={onSendEmail}
              variant="outline" 
              size="sm"
              className="flex-1 sm:flex-none sm:w-9 h-9"
              data-testid={`button-send-email-${invoice.id}`}
            >
              <Mail className="w-4 h-4" />
              <span className="ml-1 sm:hidden">Email</span>
            </Button>
            <Button 
              onClick={onDownload}
              variant="outline" 
              size="sm"
              className="flex-1 sm:flex-none sm:w-9 h-9"
              data-testid={`button-download-${invoice.id}`}
            >
              <Download className="w-4 h-4" />
              <span className="ml-1 sm:hidden">Shkarko</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
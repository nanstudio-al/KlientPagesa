import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Calendar, FileText, DollarSign, Download, Mail, Package } from "lucide-react";
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

  // Get the total amount (new or legacy)
  const getTotalAmount = () => {
    return invoice.totalAmount || invoice.amount || "0";
  };

  return (
    <Card className="hover-elevate" data-testid={`card-invoice-${invoice.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <div>
            <h3 className="font-semibold" data-testid={`text-invoice-client-${invoice.id}`}>
              {invoice.clientName}
            </h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Package className="w-3 h-3" />
              <span data-testid={`text-invoice-service-${invoice.id}`}>
                {getServicesDisplay()}
              </span>
            </div>
          </div>
        </div>
        <StatusBadge status={isOverdue ? 'overdue' : invoice.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xl font-mono font-semibold" data-testid={`text-invoice-amount-${invoice.id}`}>
              {getTotalAmount()}€
            </span>
          </div>
        </div>

        {/* Show detailed services breakdown if multiple services */}
        {invoice.services && invoice.services.length > 1 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Shërbimet:</p>
            <div className="space-y-1 text-xs">
              {invoice.services.map((service, index) => (
                <div key={`${service.serviceId}-${index}`} className="flex justify-between">
                  <span>{service.service.name}</span>
                  <span>{service.quantity}x {service.unitPrice}€</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Data e lëshimit:</span>
            <span data-testid={`text-invoice-issue-date-${invoice.id}`}>
              {formatDate(invoice.issueDate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Data e skadencës:</span>
            <span 
              className={isOverdue ? 'text-destructive font-medium' : ''}
              data-testid={`text-invoice-due-date-${invoice.id}`}
            >
              {formatDate(invoice.dueDate)}
            </span>
          </div>
          {invoice.paidDate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Data e pagesës:</span>
              <span className="text-chart-2 font-medium" data-testid={`text-invoice-paid-date-${invoice.id}`}>
                {formatDate(invoice.paidDate)}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {invoice.status !== 'paid' && (
            <Button 
              onClick={onMarkPaid}
              variant="default" 
              size="sm"
              className="flex-1"
              data-testid={`button-mark-paid-${invoice.id}`}
            >
              Shëno si të paguar
            </Button>
          )}
          <Button 
            onClick={onSendEmail}
            variant="outline" 
            size="sm"
            data-testid={`button-send-email-${invoice.id}`}
          >
            <Mail className="w-4 h-4" />
          </Button>
          <Button 
            onClick={onDownload}
            variant="outline" 
            size="sm"
            data-testid={`button-download-${invoice.id}`}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
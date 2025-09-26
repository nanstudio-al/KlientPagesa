import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Calendar, FileText, DollarSign, Download, Mail } from "lucide-react";
import type { Invoice } from "@shared/schema";

interface InvoiceCardProps {
  invoice: Invoice & {
    clientName: string;
    serviceName: string;
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

  return (
    <Card className="hover-elevate" data-testid={`card-invoice-${invoice.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <div>
            <h3 className="font-semibold" data-testid={`text-invoice-client-${invoice.id}`}>
              {invoice.clientName}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid={`text-invoice-service-${invoice.id}`}>
              {invoice.serviceName}
            </p>
          </div>
        </div>
        <StatusBadge status={isOverdue ? 'overdue' : invoice.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xl font-mono font-semibold" data-testid={`text-invoice-amount-${invoice.id}`}>
              {invoice.amount}€
            </span>
          </div>
        </div>

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
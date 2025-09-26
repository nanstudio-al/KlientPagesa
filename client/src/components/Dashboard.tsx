import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { 
  Users, 
  Server, 
  FileText, 
  DollarSign, 
  AlertTriangle,
  TrendingUp,
  Plus
} from "lucide-react";

interface DashboardStats {
  totalClients: number;
  activeServices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  monthlyRevenue: number;
  pendingAmount: number;
}

interface DashboardProps {
  stats: DashboardStats;
  recentInvoices: Array<{
    id: string;
    clientName: string;
    serviceName: string;
    amount: string;
    dueDate: Date;
    status: 'paid' | 'pending' | 'overdue';
  }>;
  upcomingPayments: Array<{
    id: string;
    clientName: string;
    serviceName: string;
    amount: string;
    dueDate: Date;
  }>;
  onCreateClient: () => void;
  onCreateInvoice: () => void;
}

export function Dashboard({ 
  stats, 
  recentInvoices, 
  upcomingPayments, 
  onCreateClient, 
  onCreateInvoice 
}: DashboardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('sq-AL');
  };

  const isOverdue = (date: Date) => new Date(date) < new Date();
  const isDueSoon = (date: Date) => {
    const days = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days <= 7 && days >= 0;
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Button onClick={onCreateClient} data-testid="button-create-client">
          <Plus className="w-4 h-4 mr-2" />
          Klient i ri
        </Button>
        <Button onClick={onCreateInvoice} variant="outline" data-testid="button-create-invoice">
          <Plus className="w-4 h-4 mr-2" />
          Faturë e re
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-clients">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Klientë</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-clients">
              {stats.totalClients}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-services">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shërbime aktive</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-services">
              {stats.activeServices}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-invoices">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fatura në pritje</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-invoices">
              {stats.pendingInvoices}
            </div>
            {stats.overdueInvoices > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.overdueInvoices} me vonesa
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Të ardhura (muaj)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-monthly-revenue">
              {stats.monthlyRevenue}€
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3 inline mr-1" />
              Në pritje: {stats.pendingAmount}€
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card data-testid="card-recent-invoices">
          <CardHeader>
            <CardTitle>Faturat e fundit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-recent-client-${invoice.id}`}>
                      {invoice.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-recent-service-${invoice.id}`}>
                      {invoice.serviceName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono font-medium text-sm" data-testid={`text-recent-amount-${invoice.id}`}>
                        {invoice.amount}€
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-recent-due-${invoice.id}`}>
                        {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <StatusBadge status={isOverdue(invoice.dueDate) && invoice.status !== 'paid' ? 'overdue' : invoice.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card data-testid="card-upcoming-payments">
          <CardHeader>
            <CardTitle>Pagesa që afrohen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-upcoming-client-${payment.id}`}>
                      {payment.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-upcoming-service-${payment.id}`}>
                      {payment.serviceName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium text-sm" data-testid={`text-upcoming-amount-${payment.id}`}>
                      {payment.amount}€
                    </p>
                    <p className={`text-xs ${isDueSoon(payment.dueDate) ? 'text-chart-3 font-medium' : 'text-muted-foreground'}`} data-testid={`text-upcoming-due-${payment.id}`}>
                      {formatDate(payment.dueDate)}
                      {isDueSoon(payment.dueDate) && ' (Afron)'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
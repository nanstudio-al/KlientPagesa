import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  FileText,
  Calendar,
  Download,
  AlertCircle
} from "lucide-react";

interface MonthlyStats {
  currentMonthRevenue: number;
  currentMonthPendingRevenue: number;
  currentMonthInvoices: number;
  totalClients: number;
  revenueGrowth: number;
}

interface TopService {
  name: string;
  revenue: number;
  clients: number;
  growth: string;
}

interface OverduePayment {
  clientName: string;
  amount: number;
  daysDue: number;
  invoiceId: string;
}

export default function ReportsPage() {
  const { data: monthlyStats, isLoading: monthlyLoading, error: monthlyError } = useQuery<MonthlyStats>({
    queryKey: ['/api/reports/monthly-stats'],
    enabled: true
  });

  const { data: topServices = [], isLoading: servicesLoading, error: servicesError } = useQuery<TopService[]>({
    queryKey: ['/api/reports/top-services'],
    enabled: true
  });

  const { data: overduePayments = [], isLoading: overdueLoading, error: overdueError } = useQuery<OverduePayment[]>({
    queryKey: ['/api/reports/overdue-payments'],
    enabled: true
  });

  const hasErrors = monthlyError || servicesError || overdueError;
  const isLoading = monthlyLoading || servicesLoading || overdueLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Duke ngarkuar raportet...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-reports">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Raporte</h1>
            <p className="text-muted-foreground">Statistika dhe analiza financiare</p>
          </div>
          <Button variant="outline" data-testid="button-export-report">
            <Download className="w-4 h-4 mr-2" />
            Eksporto raport
          </Button>
        </div>
      </div>

      {hasErrors && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Gabim në ngarkimin e raporteve. Disa të dhëna mund të mos jenë të azhurnuara.
          </AlertDescription>
        </Alert>
      )}

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card data-testid="card-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Të ardhura këtë muaj</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-current-revenue">
              {monthlyStats?.currentMonthRevenue || 0}€
            </div>
            {(monthlyStats?.currentMonthPendingRevenue || 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                + {monthlyStats?.currentMonthPendingRevenue}€ në pritje
              </p>
            )}
            <p className="text-xs flex items-center gap-1 mt-1">
              {(monthlyStats?.revenueGrowth || 0) >= 0 ? (
                <TrendingUp className="w-3 h-3 text-chart-2" />
              ) : (
                <TrendingDown className="w-3 h-3 text-destructive" />
              )}
              <span className={`${(monthlyStats?.revenueGrowth || 0) >= 0 ? 'text-chart-2' : 'text-destructive'}`}>
                {(monthlyStats?.revenueGrowth || 0) >= 0 ? '+' : ''}{monthlyStats?.revenueGrowth || 0}%
              </span> nga muaji i kaluar
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-clients-report">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Klientë aktivë</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-current-clients">
              {monthlyStats?.totalClients || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Totali i klientëve aktivë
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-invoices-issued">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fatura të lëshuara</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-current-invoices">
              {monthlyStats?.currentMonthInvoices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Këtë muaj
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <Card data-testid="card-top-services">
          <CardHeader>
            <CardTitle>Shërbimet më të suksesshme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topServices.length > 0 ? (
                topServices.map((service, index) => (
                  <div key={service.name} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`text-service-name-${index}`}>
                          {service.name}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`text-service-clients-${index}`}>
                          {service.clients} klientë
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium" data-testid={`text-service-revenue-${index}`}>
                        {service.revenue}€
                      </p>
                      <Badge 
                        variant={service.growth.startsWith('+') ? 'default' : 'secondary'}
                        className={service.growth.startsWith('+') ? 'bg-chart-2 text-white' : 'bg-chart-4 text-white'}
                      >
                        {service.growth}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nuk ka shërbime të regjistruara akoma.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Payments */}
        <Card data-testid="card-outstanding-payments">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Pagesa të prapambetura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overduePayments.length > 0 ? (
                <>
                  {overduePayments.map((payment, index) => (
                    <div key={payment.clientName} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium" data-testid={`text-outstanding-client-${index}`}>
                          {payment.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`text-outstanding-days-${index}`}>
                          {payment.daysDue} ditë vonesa
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-medium text-destructive" data-testid={`text-outstanding-amount-${index}`}>
                          {payment.amount}€
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Totali</p>
                      <p className="font-mono font-bold text-lg text-destructive">
                        {overduePayments.reduce((sum, payment) => sum + payment.amount, 0)}€
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nuk ka pagesa të prapambetura.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Summary */}
      <Card className="mt-6" data-testid="card-monthly-summary">
        <CardHeader>
          <CardTitle>Përmbledhja e muajit aktual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Të ardhura</p>
              <p className="text-2xl font-bold font-mono">
                {monthlyStats?.currentMonthRevenue || 0}€
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Fatura</p>
              <p className="text-2xl font-bold">
                {monthlyStats?.currentMonthInvoices || 0}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Klientë</p>
              <p className="text-2xl font-bold">
                {monthlyStats?.totalClients || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
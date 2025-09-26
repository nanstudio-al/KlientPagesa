import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  FileText,
  Calendar,
  Download
} from "lucide-react";

export default function ReportsPage() {
  //todo: remove mock functionality
  const mockMonthlyData = [
    { month: 'Janar', revenue: 3200, clients: 18, invoices: 45 },
    { month: 'Shkurt', revenue: 3800, clients: 20, invoices: 52 },
    { month: 'Mars', revenue: 4100, clients: 22, invoices: 58 },
    { month: 'Prill', revenue: 3900, clients: 21, invoices: 55 },
    { month: 'Maj', revenue: 4250, clients: 24, invoices: 61 },
  ];

  const mockTopServices = [
    { name: 'Hostim Web', revenue: 2400, clients: 12, growth: '+15%' },
    { name: 'Email Business', revenue: 900, clients: 18, growth: '+8%' },
    { name: 'Support Teknik', revenue: 600, clients: 4, growth: '+25%' },
    { name: 'Domain Registration', revenue: 350, clients: 14, growth: '-5%' },
  ];

  const mockOutstandingPayments = [
    { clientName: 'Alfa Shpk', amount: 250, daysDue: 15 },
    { clientName: 'Beta Solutions', amount: 150, daysDue: 8 },
    { clientName: 'Gamma Corp', amount: 200, daysDue: 3 },
  ];

  const currentMonth = mockMonthlyData[mockMonthlyData.length - 1];
  const previousMonth = mockMonthlyData[mockMonthlyData.length - 2];
  const revenueGrowth = ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue * 100).toFixed(1);
  const clientGrowth = ((currentMonth.clients - previousMonth.clients) / previousMonth.clients * 100).toFixed(1);

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

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card data-testid="card-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Të ardhura këtë muaj</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-current-revenue">
              {currentMonth.revenue}€
            </div>
            <p className="text-xs flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-chart-2" />
              <span className="text-chart-2">+{revenueGrowth}%</span> nga muaji i kaluar
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
              {currentMonth.clients}
            </div>
            <p className="text-xs flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-chart-2" />
              <span className="text-chart-2">+{clientGrowth}%</span> nga muaji i kaluar
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
              {currentMonth.invoices}
            </div>
            <p className="text-xs text-muted-foreground">
              Mesatarisht {(currentMonth.invoices / 30).toFixed(1)} në ditë
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
              {mockTopServices.map((service, index) => (
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
              ))}
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
              {mockOutstandingPayments.map((payment, index) => (
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
                    {mockOutstandingPayments.reduce((sum, p) => sum + p.amount, 0)}€
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="mt-6" data-testid="card-monthly-trend">
        <CardHeader>
          <CardTitle>Tendenca mujore</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockMonthlyData.map((month, index) => (
              <div key={month.month} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <p className="font-medium" data-testid={`text-month-${index}`}>
                    {month.month} 2024
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-6 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Të ardhura</p>
                    <p className="font-mono font-medium" data-testid={`text-month-revenue-${index}`}>
                      {month.revenue}€
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Klientë</p>
                    <p className="font-medium" data-testid={`text-month-clients-${index}`}>
                      {month.clients}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fatura</p>
                    <p className="font-medium" data-testid={`text-month-invoices-${index}`}>
                      {month.invoices}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
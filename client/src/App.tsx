import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import DashboardPage from "@/pages/DashboardPage";
import ClientsPage from "@/pages/ClientsPage";
import ServicesPage from "@/pages/ServicesPage";
import InvoicesPage from "@/pages/InvoicesPage";
import ReportsPage from "@/pages/ReportsPage";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/not-found";

function Router() {
  // From Replit Auth integration blueprint
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={LandingPage} />
      ) : (
        <>
          <Route path="/" component={DashboardPage} />
          <Route path="/clients" component={ClientsPage} />
          <Route path="/services" component={ServicesPage} />
          <Route path="/invoices" component={InvoicesPage} />
          <Route path="/reports" component={ReportsPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between p-4 border-b bg-background">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <h2 className="font-semibold text-lg">Menaxhimi i Klientëve</h2>
                  </div>
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <div className="container max-w-7xl mx-auto p-6">
                    <Router />
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

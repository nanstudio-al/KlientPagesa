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
import UserManagementPage from "@/pages/UserManagementPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/not-found";

function AuthenticatedApp() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/services" component={ServicesPage} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/users" component={UserManagementPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (isLoading) {
    // Loading state
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Duke u ngarkuar...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Show login page for unauthenticated users
    return <LoginPage />;
  }

  // Show full application with sidebar for authenticated users
  return (
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
              <AuthenticatedApp />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppContent />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

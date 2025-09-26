import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientCard } from "@/components/ClientCard";
import { ClientForm } from "@/components/ClientForm";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { InsertClient } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function ClientsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['/api/clients'],
    enabled: true
  });

  const createClientMutation = useMutation({
    mutationFn: (data: InsertClient) => apiRequest('POST', '/api/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Klienti u krijua me sukses!" });
      setIsFormOpen(false);
    },
    onError: () => {
      toast({ title: "Gabim në krijimin e klientit", variant: "destructive" });
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertClient }) => 
      apiRequest('PUT', `/api/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Klienti u përditësua me sukses!" });
      setIsFormOpen(false);
      setEditingClient(null);
    },
    onError: () => {
      toast({ title: "Gabim në përditësimin e klientit", variant: "destructive" });
    }
  });

  const deleteClientMutation = useMutation({
    mutationFn: (clientId: string) => apiRequest('DELETE', `/api/clients/${clientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Klienti u fshi me sukses!" });
      setDeletingClient(null);
    },
    onError: () => {
      toast({ title: "Gabim në fshirjen e klientit", variant: "destructive" });
    }
  });

  const filteredClients = (clients as any[]).filter((client: any) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleClientSubmit = (data: InsertClient) => {
    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data });
    } else {
      createClientMutation.mutate(data);
    }
  };

  const handleViewClient = (clientId: string) => {
    const client = (clients as any[]).find((c: any) => c.id === clientId);
    if (client) {
      setViewingClient(client);
    }
  };

  const handleEditClient = (clientId: string) => {
    const client = (clients as any[]).find((c: any) => c.id === clientId);
    if (client) {
      setEditingClient(client);
      setIsFormOpen(true);
    }
  };

  const handleDeleteClient = (clientId: string) => {
    setDeletingClient(clientId);
  };

  const confirmDelete = () => {
    if (deletingClient) {
      deleteClientMutation.mutate(deletingClient);
    }
  };

  const handleNewClient = () => {
    setEditingClient(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingClient(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Duke ngarkuar klientët...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-clients">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Klientët</h1>
            <p className="text-muted-foreground">Menaxho klientët dhe informacionin e tyre</p>
          </div>
          <Button onClick={handleNewClient} data-testid="button-new-client">
            <Plus className="w-4 h-4 mr-2" />
            Klient i ri
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kërko klientë..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            data-testid="input-search-clients"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onView={() => handleViewClient(client.id)}
            onEdit={() => handleEditClient(client.id)}
            onDelete={() => handleDeleteClient(client.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
            Mbrapa
          </Button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                data-testid={`button-page-${page}`}
              >
                {page}
              </Button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            data-testid="button-next-page"
          >
            Para
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {currentClients.length === 0 && filteredClients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nuk u gjetën klientë</p>
          {searchTerm && (
            <Button 
              variant="outline" 
              onClick={() => handleSearchChange("")} 
              className="mt-4"
              data-testid="button-clear-search"
            >
              Pastro kërkimin
            </Button>
          )}
        </div>
      )}

      {/* Client Form Dialog */}
      <ClientForm 
        isOpen={isFormOpen}
        onOpenChange={handleCloseForm}
        onSubmit={handleClientSubmit}
        initialData={editingClient ? {
          name: editingClient.name,
          email: editingClient.email,
          phone: editingClient.phone || "",
          address: editingClient.address || "",
          taxId: editingClient.taxId || "",
          isCompany: !!editingClient.isCompany
        } : undefined}
        title={editingClient ? "Përditëso klientin" : "Klient i ri"}
      />

      {/* View Client Dialog */}
      {viewingClient && (
        <Dialog open={!!viewingClient} onOpenChange={() => setViewingClient(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detajet e klientit</DialogTitle>
              <DialogDescription>Informacioni i detajuar për klientin</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Emri</p>
                  <p className="text-sm">{viewingClient.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lloji</p>
                  <p className="text-sm">{viewingClient.isCompany ? "Kompani" : "Person"}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm">{viewingClient.email}</p>
                </div>
                {viewingClient.phone && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Telefoni</p>
                    <p className="text-sm">{viewingClient.phone}</p>
                  </div>
                )}
              </div>

              {viewingClient.address && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Adresa</p>
                  <p className="text-sm">{viewingClient.address}</p>
                </div>
              )}

              {viewingClient.taxId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Numri fiskal</p>
                  <p className="text-sm">{viewingClient.taxId}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Shërbimet aktive</p>
                <div className="flex flex-wrap gap-2">
                  {viewingClient.services?.length > 0 ? (
                    viewingClient.services.map((service: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-secondary rounded-md text-xs">
                        {service}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nuk ka shërbime aktive</p>
                  )}
                </div>
              </div>

              {(viewingClient.totalPending > 0 || viewingClient.overdueCount > 0) && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Informacioni i pagesave</p>
                  {viewingClient.totalPending > 0 && (
                    <p className="text-sm">Pagesa në pritje: <span className="font-mono font-medium">{viewingClient.totalPending}€</span></p>
                  )}
                  {viewingClient.overdueCount > 0 && (
                    <p className="text-sm text-destructive">Pagesa me vonesa: {viewingClient.overdueCount}</p>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingClient} onOpenChange={() => setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmo fshirjen</AlertDialogTitle>
            <AlertDialogDescription>
              A je i sigurt që dëshiron të fshish këtë klient? Kjo veprim nuk mund të kthehet mbrapa.
              Të gjitha të dhënat e klientit, shërbimet dhe faturat do të fshihen gjithashtu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulo</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Fshi klientin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
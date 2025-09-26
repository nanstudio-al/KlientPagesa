import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientCard } from "@/components/ClientCard";
import { ClientForm } from "@/components/ClientForm";
import { Plus, Search } from "lucide-react";
import type { InsertClient } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ClientsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
    },
    onError: () => {
      toast({ title: "Gabim në krijimin e klientit", variant: "destructive" });
    }
  });

  const filteredClients = (clients as any[]).filter((client: any) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClientSubmit = (data: InsertClient) => {
    createClientMutation.mutate(data);
  };

  const handleViewClient = (clientId: string) => {
    console.log('View client:', clientId);
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
          <Button onClick={() => setIsFormOpen(true)} data-testid="button-new-client">
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-clients"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onView={() => handleViewClient(client.id)}
          />
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nuk u gjetën klientë</p>
          {searchTerm && (
            <Button 
              variant="outline" 
              onClick={() => setSearchTerm("")} 
              className="mt-4"
              data-testid="button-clear-search"
            >
              Pastro kërkimin
            </Button>
          )}
        </div>
      )}

      <ClientForm 
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleClientSubmit}
      />
    </div>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientCard } from "@/components/ClientCard";
import { ClientForm } from "@/components/ClientForm";
import { Plus, Search } from "lucide-react";

export default function ClientsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  //todo: remove mock functionality
  const mockClients = [
    {
      id: '1',
      name: 'Alfa Shpk',
      email: 'info@alfashpk.al',
      phone: '+355 69 123 4567',
      address: 'Rruga e Durrësit 10, Tiranë',
      taxId: 'K12345678A',
      isCompany: 1,
      createdAt: new Date(),
      services: ['Hostim', 'Email', 'Support'],
      totalPending: 250,
      overdueCount: 1,
    },
    {
      id: '2',
      name: 'Marko Beqiri',
      email: 'marko@example.com',
      phone: '+355 69 987 6543',
      address: 'Rruga Myslym Shyri, Tiranë',
      taxId: null,
      isCompany: 0,
      createdAt: new Date(),
      services: ['Hostim'],
      totalPending: 200,
      overdueCount: 0,
    },
    {
      id: '3',
      name: 'Tech Solutions Ltd',
      email: 'contact@techsolutions.al',
      phone: '+355 4 123 4567',
      address: 'Bulevardi Dëshmorët e Kombit, Tiranë',
      taxId: 'K87654321B',
      isCompany: 1,
      createdAt: new Date(),
      services: ['Hostim', 'Domain', 'SEO'],
      totalPending: 0,
      overdueCount: 0,
    },
  ];

  const filteredClients = mockClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClientSubmit = (data: any) => {
    console.log('Client created:', data);
  };

  const handleViewClient = (clientId: string) => {
    console.log('View client:', clientId);
  };

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
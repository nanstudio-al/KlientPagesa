import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceForm } from "@/components/ServiceForm";
import { Plus, Search } from "lucide-react";

export default function ServicesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  //todo: remove mock functionality
  const mockServices = [
    {
      id: '1',
      name: 'Hostim Web',
      description: 'Hostim i plotë për faqe interneti me SSL dhe backup automatik',
      price: '200.00',
      billingPeriod: 'yearly',
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Email Business',
      description: 'Shërbim email profesional me domain personalizado',
      price: '50.00',
      billingPeriod: 'monthly',
      createdAt: new Date(),
    },
    {
      id: '3',
      name: 'Support Teknik',
      description: 'Support teknik 24/7 për të gjitha shërbimet',
      price: '150.00',
      billingPeriod: 'monthly',
      createdAt: new Date(),
    },
    {
      id: '4',
      name: 'Domain Registration',
      description: 'Regjistrim dhe menaxhim domenesh',
      price: '25.00',
      billingPeriod: 'yearly',
      createdAt: new Date(),
    },
  ];

  const filteredServices = mockServices.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleServiceSubmit = (data: any) => {
    console.log('Service created:', data);
  };

  const handleEditService = (serviceId: string) => {
    console.log('Edit service:', serviceId);
  };

  const handleDeleteService = (serviceId: string) => {
    console.log('Delete service:', serviceId);
  };

  return (
    <div data-testid="page-services">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shërbimet</h1>
            <p className="text-muted-foreground">Menaxho shërbimet që ofron kompania</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} data-testid="button-new-service">
            <Plus className="w-4 h-4 mr-2" />
            Shërbim i ri
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kërko shërbime..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-services"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onEdit={() => handleEditService(service.id)}
            onDelete={() => handleDeleteService(service.id)}
          />
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nuk u gjetën shërbime</p>
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

      <ServiceForm 
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleServiceSubmit}
      />
    </div>
  );
}
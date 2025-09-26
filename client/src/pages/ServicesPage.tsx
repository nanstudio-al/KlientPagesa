import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceForm } from "@/components/ServiceForm";
import { Plus, Search } from "lucide-react";
import type { InsertService } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ServicesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['/api/services'],
    enabled: true
  });

  const createServiceMutation = useMutation({
    mutationFn: (data: InsertService) => apiRequest('POST', '/api/services', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Shërbimi u krijua me sukses!" });
    },
    onError: () => {
      toast({ title: "Gabim në krijimin e shërbimt", variant: "destructive" });
    }
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: string) => apiRequest('DELETE', `/api/services/${serviceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Shërbimi u fshi me sukses!" });
    },
    onError: () => {
      toast({ title: "Gabim në fshirjen e shërbimt", variant: "destructive" });
    }
  });

  const filteredServices = (services as any[]).filter((service: any) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleServiceSubmit = (data: InsertService) => {
    createServiceMutation.mutate(data);
  };

  const handleEditService = (serviceId: string) => {
    console.log('Edit service:', serviceId);
  };

  const handleDeleteService = (serviceId: string) => {
    deleteServiceMutation.mutate(serviceId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Duke ngarkuar shërbimet...</p>
        </div>
      </div>
    );
  }

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
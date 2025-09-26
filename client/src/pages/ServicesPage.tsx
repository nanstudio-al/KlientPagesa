import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceForm } from "@/components/ServiceForm";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { InsertService } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ServicesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
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
      setIsFormOpen(false);
    },
    onError: () => {
      toast({ title: "Gabim në krijimin e shërbimt", variant: "destructive" });
    }
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertService }) => 
      apiRequest('PUT', `/api/services/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: "Shërbimi u përditësua me sukses!" });
      setIsFormOpen(false);
      setEditingService(null);
    },
    onError: () => {
      toast({ title: "Gabim në përditësimin e shërbimt", variant: "destructive" });
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

  // Pagination logic
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentServices = filteredServices.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleServiceSubmit = (data: InsertService) => {
    if (editingService) {
      updateServiceMutation.mutate({ id: editingService.id, data });
    } else {
      createServiceMutation.mutate(data);
    }
  };

  const handleEditService = (serviceId: string) => {
    const service = services.find((s: any) => s.id === serviceId);
    if (service) {
      setEditingService(service);
      setIsFormOpen(true);
    }
  };

  const handleNewService = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingService(null);
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
          <Button onClick={handleNewService} data-testid="button-new-service">
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            data-testid="input-search-services"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentServices.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onEdit={() => handleEditService(service.id)}
            onDelete={() => handleDeleteService(service.id)}
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

      {currentServices.length === 0 && filteredServices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nuk u gjetën shërbime</p>
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

      <ServiceForm 
        isOpen={isFormOpen}
        onOpenChange={handleCloseForm}
        onSubmit={handleServiceSubmit}
        initialData={editingService ? {
          name: editingService.name,
          description: editingService.description || "",
          price: editingService.price.toString(),
          billingPeriod: editingService.billingPeriod
        } : undefined}
        title={editingService ? "Përditëso shërbimin" : "Shërbim i ri"}
      />
    </div>
  );
}
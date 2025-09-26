import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Server } from "lucide-react";
import type { Service } from "@shared/schema";

interface ServiceCardProps {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
}

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const getBillingPeriodText = (period: string) => {
    switch (period) {
      case "monthly": return "Mujor";
      case "quarterly": return "3-Mujor";
      case "yearly": return "Vjetor";
      default: return period;
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`card-service-${service.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg" data-testid={`text-service-name-${service.id}`}>
            {service.name}
          </h3>
        </div>
        <Badge variant="outline" data-testid={`badge-period-${service.id}`}>
          {getBillingPeriodText(service.billingPeriod)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {service.description && (
          <p className="text-sm text-muted-foreground" data-testid={`text-service-description-${service.id}`}>
            {service.description}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Çmimi</p>
            <p className="text-xl font-mono font-semibold" data-testid={`text-service-price-${service.id}`}>
              {service.price}€
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Periudha</p>
            <p className="text-sm font-medium">
              {getBillingPeriodText(service.billingPeriod)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={onEdit}
            variant="outline" 
            size="sm" 
            className="flex-1"
            data-testid={`button-edit-service-${service.id}`}
          >
            <Edit className="w-4 h-4 mr-2" />
            Ndrysho
          </Button>
          <Button 
            onClick={onDelete}
            variant="outline" 
            size="sm" 
            className="text-destructive hover:bg-destructive/10"
            data-testid={`button-delete-service-${service.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
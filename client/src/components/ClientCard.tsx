import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { User, Building2, Mail, Phone, MapPin, Eye } from "lucide-react";
import type { Client, PaymentStatus } from "@shared/schema";

interface ClientCardProps {
  client: Client & {
    services: string[];
    totalPending: number;
    overdueCount: number;
  };
  onView: () => void;
}

export function ClientCard({ client, onView }: ClientCardProps) {
  const getClientStatus = () => {
    // Show client type and status instead of payment status
    if (client.isCompany) {
      return { type: "company", label: "Kompani" };
    } else {
      return { type: "individual", label: "Person" };
    }
  };

  const hasPaymentIssues = client.overdueCount > 0 || client.totalPending > 0;

  return (
    <Card className="hover-elevate" data-testid={`card-client-${client.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {client.isCompany ? (
            <Building2 className="w-4 h-4 text-muted-foreground" />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-lg" data-testid={`text-client-name-${client.id}`}>
            {client.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={client.isCompany ? "default" : "secondary"}>
            {getClientStatus().label}
          </Badge>
          {hasPaymentIssues && (
            <Badge variant={client.overdueCount > 0 ? "destructive" : "outline"}>
              {client.overdueCount > 0 ? "Vonesa" : "Në pritje"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span data-testid={`text-client-email-${client.id}`}>{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span data-testid={`text-client-phone-${client.id}`}>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span data-testid={`text-client-address-${client.id}`}>{client.address}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Shërbimet aktive:</p>
          <div className="flex flex-wrap gap-1">
            {client.services.map((service, index) => (
              <Badge key={index} variant="secondary" className="text-xs" data-testid={`badge-service-${index}`}>
                {service}
              </Badge>
            ))}
          </div>
        </div>

        {(client.totalPending > 0 || client.overdueCount > 0) && (
          <div className="pt-2 space-y-1">
            {client.totalPending > 0 && (
              <p className="text-sm text-muted-foreground" data-testid={`text-pending-${client.id}`}>
                Pagesa në pritje: <span className="font-mono font-medium">{client.totalPending}€</span>
              </p>
            )}
            {client.overdueCount > 0 && (
              <p className="text-sm text-destructive" data-testid={`text-overdue-${client.id}`}>
                Pagesa me vonesa: {client.overdueCount}
              </p>
            )}
          </div>
        )}

        <Button 
          onClick={onView} 
          className="w-full" 
          variant="outline"
          data-testid={`button-view-client-${client.id}`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Shiko detajet
        </Button>
      </CardContent>
    </Card>
  );
}
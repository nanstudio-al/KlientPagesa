import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import type { PaymentStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: PaymentStatus) => {
    switch (status) {
      case "paid":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          text: "Paguar",
          className: "bg-chart-2 text-white hover:bg-chart-2/90",
        };
      case "pending":
        return {
          variant: "secondary" as const,
          icon: Clock,
          text: "Në pritje",
          className: "bg-chart-3 text-white hover:bg-chart-3/90",
        };
      case "overdue":
        return {
          variant: "destructive" as const,
          icon: AlertTriangle,
          text: "Vonesa",
          className: "bg-chart-4 text-white hover:bg-chart-4/90",
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={`flex items-center gap-1 ${config.className} ${className}`}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="w-3 h-3" />
      {config.text}
    </Badge>
  );
}
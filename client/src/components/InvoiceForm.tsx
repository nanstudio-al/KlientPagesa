import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InsertInvoice } from "@shared/schema";

const invoiceFormSchema = z.object({
  clientId: z.string().min(1, "Zgjidh një klient"),
  serviceId: z.string().min(1, "Zgjidh një shërbim"),
  amount: z.string().min(1, "Shuma është e detyrueshme").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Shuma duhet të jetë një numër pozitiv"),
  dueDate: z.string().min(1, "Data e skadencës është e detyrueshme"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertInvoice) => void;
  title?: string;
}

export function InvoiceForm({ isOpen, onOpenChange, onSubmit, title = "Faturë e re" }: InvoiceFormProps) {
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: "",
      serviceId: "",
      amount: "",
      dueDate: "",
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients'],
    enabled: isOpen
  });

  const { data: services = [] } = useQuery({
    queryKey: ['/api/services'],
    enabled: isOpen
  });

  const handleSubmit = (data: InvoiceFormData) => {
    onSubmit({
      clientId: data.clientId,
      serviceId: data.serviceId,
      amount: data.amount,
      dueDate: new Date(data.dueDate),
      status: 'pending' as const
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-invoice-form">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Klienti *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-client">
                        <SelectValue placeholder="Zgjidh klientin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(clients as any[]).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shërbimi *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-service">
                        <SelectValue placeholder="Zgjidh shërbimin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(services as any[]).map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - {service.price}€/{service.billingPeriod === 'monthly' ? 'muaj' : service.billingPeriod === 'yearly' ? 'vit' : '3 muaj'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shuma *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="200" 
                        type="number"
                        step="0.01"
                        min="0"
                        {...field} 
                        data-testid="input-invoice-amount"
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">€</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e skadencës *</FormLabel>
                  <FormControl>
                    <Input 
                      type="date"
                      {...field} 
                      data-testid="input-due-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Anulo
              </Button>
              <Button type="submit" data-testid="button-save-invoice">
                Ruaj
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
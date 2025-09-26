import { useForm, useFieldArray } from "react-hook-form";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Plus } from "lucide-react";
import type { InsertInvoice } from "@shared/schema";

const invoiceFormSchema = z.object({
  clientId: z.string().min(1, "Zgjidh një klient"),
  services: z.array(z.object({
    serviceId: z.string().min(1, "Zgjidh një shërbim"),
    quantity: z.number().min(1, "Sasia duhet të jetë së paku 1"),
  })).min(1, "Së paku një shërbim është i detyrueshëm"),
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
      services: [{ serviceId: "", quantity: 1 }],
      dueDate: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "services",
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
      services: data.services,
      dueDate: new Date(data.dueDate),
      status: 'pending' as const
    });
    form.reset();
    onOpenChange(false);
  };

  // Add a new service row
  const addService = () => {
    append({ serviceId: "", quantity: 1 });
  };

  // Remove a service row
  const removeService = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-invoice-form">
        <DialogHeader className="sticky top-0 z-10 bg-background pb-4">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription>
            Plotëso të gjitha fushat e detyrueshme për të krijuar një faturë të re. Mund të shtosh shume shërbime sipas nevojës.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Klienti *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10" data-testid="select-client">
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
            </div>

            {/* Services Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-medium">Shërbimet *</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addService}
                  className="h-8 px-3 text-xs"
                  data-testid="button-add-service"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Shto shërbim</span>
                  <span className="sm:hidden">Shto</span>
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-3 border rounded-lg bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Shërbimi #{index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeService(index)}
                        disabled={fields.length === 1}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        data-testid={`button-remove-service-${index}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name={`services.${index}.serviceId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Zgjedh shërbimin</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9" data-testid={`select-service-${index}`}>
                                  <SelectValue placeholder="Zgjidh shërbimin" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(services as any[]).map((service) => (
                                  <SelectItem key={service.id} value={service.id}>
                                    <div className="flex flex-col">
                                      <span>{service.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {service.price}€/{service.billingPeriod === 'monthly' ? 'muaj' : service.billingPeriod === 'yearly' ? 'vit' : '3 muaj'}
                                      </span>
                                    </div>
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
                        name={`services.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Sasia</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                className="h-9"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                data-testid={`input-quantity-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Data e skadencës *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        className="h-10"
                        {...field} 
                        data-testid="input-due-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t sticky bottom-0 bg-background">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none h-10"
                data-testid="button-cancel"
              >
                Anulo
              </Button>
              <Button 
                type="submit" 
                className="flex-1 sm:flex-none h-10"
                data-testid="button-save-invoice"
              >
                Ruaj faturën
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
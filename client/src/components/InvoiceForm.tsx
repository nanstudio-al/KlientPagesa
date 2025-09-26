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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Shërbimet *</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addService}
                  data-testid="button-add-service"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Shto shërbim
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <FormField
                    control={form.control}
                    name={`services.${index}.serviceId`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        {index === 0 && <FormLabel>Shërbimi</FormLabel>}
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-service-${index}`}>
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
                    name={`services.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-20">
                        {index === 0 && <FormLabel>Sasia</FormLabel>}
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            data-testid={`input-quantity-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeService(index)}
                    disabled={fields.length === 1}
                    data-testid={`button-remove-service-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

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
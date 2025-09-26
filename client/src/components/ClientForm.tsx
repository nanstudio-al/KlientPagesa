import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InsertClient } from "@shared/schema";

const clientFormSchema = z.object({
  name: z.string().min(2, "Emri duhet të ketë të paktën 2 karaktere"),
  email: z.string().email("Email i pavlefshëm"),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  isCompany: z.boolean().default(false),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertClient) => void;
  initialData?: Partial<ClientFormData>;
  title?: string;
}

export function ClientForm({ isOpen, onOpenChange, onSubmit, initialData, title = "Klient i ri" }: ClientFormProps) {
  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      taxId: initialData?.taxId || "",
      isCompany: initialData?.isCompany || false,
    },
  });

  // Reset form when initialData changes (for editing existing clients)
  useEffect(() => {
    if (initialData) {
      // Editing existing client
      form.reset({
        name: initialData.name || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        address: initialData.address || "",
        taxId: initialData.taxId || "",
        isCompany: Boolean(initialData.isCompany), // Normalize to boolean
      });
    } else if (isOpen) {
      // Creating new client - reset to blank form
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        taxId: "",
        isCompany: false,
      });
    }
  }, [initialData, isOpen, form]);

  const handleSubmit = (data: ClientFormData) => {
    onSubmit({
      ...data,
      isCompany: data.isCompany ? 1 : 0,
    });
    form.reset();
    onOpenChange(false);
  };

  const isCompany = form.watch("isCompany");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-client-form">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emri *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={isCompany ? "Emri i kompanisë" : "Emri i plotë"} 
                      {...field} 
                      data-testid="input-client-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="email@shembull.com" 
                      type="email" 
                      {...field} 
                      data-testid="input-client-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numri i telefonit</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="+355 69 123 4567" 
                      {...field} 
                      data-testid="input-client-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresa</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Adresa e plotë" 
                      {...field} 
                      data-testid="input-client-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isCompany"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Kompani</FormLabel>
                    <FormDescription>
                      A është ky klient një kompani?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-is-company"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {isCompany && (
              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIPT</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="K12345678A" 
                        {...field} 
                        data-testid="input-client-tax-id"
                      />
                    </FormControl>
                    <FormDescription>
                      Numri i identifikimit për personin tatimpagyes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Anulo
              </Button>
              <Button type="submit" data-testid="button-save-client">
                Ruaj
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
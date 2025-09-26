import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { InsertService } from "@shared/schema";

const serviceFormSchema = z.object({
  name: z.string().min(2, "Emri duhet të ketë të paktën 2 karaktere"),
  description: z.string().optional(),
  price: z.string().min(1, "Çmimi është i detyrueshëm").refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Çmimi duhet të jetë një numër pozitiv"),
  billingPeriod: z.enum(["monthly", "quarterly", "yearly"], {
    required_error: "Zgjidh periudhën e faturimit",
  }),
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;

interface ServiceFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertService) => void;
  initialData?: Partial<ServiceFormData>;
  title?: string;
}

export function ServiceForm({ isOpen, onOpenChange, onSubmit, initialData, title = "Shërbim i ri" }: ServiceFormProps) {
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price || "",
      billingPeriod: initialData?.billingPeriod || "monthly",
    },
  });

  const handleSubmit = (data: ServiceFormData) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-service-form">
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
                  <FormLabel>Emri i shërbimit *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Hostim Web, Email, Support..." 
                      {...field} 
                      data-testid="input-service-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Përshkrimi</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Përshkrimi i detajuar i shërbimit" 
                      {...field} 
                      data-testid="input-service-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Çmimi *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="200" 
                          type="number"
                          step="0.01"
                          min="0"
                          {...field} 
                          data-testid="input-service-price"
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
                name="billingPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periudha *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-billing-period">
                          <SelectValue placeholder="Zgjidh periudhën" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Mujor</SelectItem>
                        <SelectItem value="quarterly">3-Mujor</SelectItem>
                        <SelectItem value="yearly">Vjetor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Anulo
              </Button>
              <Button type="submit" data-testid="button-save-service">
                Ruaj
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
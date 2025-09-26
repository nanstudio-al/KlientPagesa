import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Edit, Key, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type User } from "@shared/schema";

const createUserSchema = z.object({
  username: z.string().min(1, "Emri i përdoruesit është i detyruar"),
  password: z.string().min(6, "Fjalëkalimi duhet të jetë të paktën 6 karaktere"),
  email: z.string().email("Email-i nuk është valid").optional().or(z.literal("")),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "user"], { required_error: "Roli është i detyruar" }),
});

const updateUserSchema = z.object({
  username: z.string().min(1, "Emri i përdoruesit është i detyruar"),
  email: z.string().email("Email-i nuk është valid").optional().or(z.literal("")),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "user"], { required_error: "Roli është i detyruar" }),
  isActive: z.number().min(0).max(1),
});

const passwordResetSchema = z.object({
  password: z.string().min(6, "Fjalëkalimi duhet të jetë të paktën 6 karaktere"),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type UpdateUserForm = z.infer<typeof updateUserSchema>;
type PasswordResetForm = z.infer<typeof passwordResetSchema>;

type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "user";
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

export default function UserManagementPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users
  const { data: users = [], isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
  });

  // Create user form
  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "user",
    },
  });

  // Update user form
  const updateForm = useForm<UpdateUserForm>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "user",
      isActive: 1,
    },
  });

  // Password reset form
  const passwordForm = useForm<PasswordResetForm>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      password: "",
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await apiRequest('POST', '/api/admin/users', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Përdoruesi u krijua",
        description: "Përdoruesi i ri u krijua me sukses.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Gabim në krijimin e përdoruesit",
        description: error.message || "Ndodhi një gabim gjatë krijimit të përdoruesit.",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: UpdateUserForm & { id: string }) => {
      const { id, ...updateData } = data;
      const response = await apiRequest('PATCH', `/api/admin/users/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      updateForm.reset();
      toast({
        title: "Përdoruesi u përditësua",
        description: "Të dhënat e përdoruesit u përditësuan me sukses.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Gabim në përditësimin e përdoruesit",
        description: error.message || "Ndodhi një gabim gjatë përditësimit të përdoruesit.",
        variant: "destructive",
      });
    },
  });

  // Password reset mutation
  const passwordResetMutation = useMutation({
    mutationFn: async (data: PasswordResetForm & { id: string }) => {
      const { id, ...passwordData } = data;
      const response = await apiRequest('POST', `/api/admin/users/${id}/password`, passwordData);
      return response.json();
    },
    onSuccess: () => {
      setIsPasswordDialogOpen(false);
      setSelectedUser(null);
      passwordForm.reset();
      toast({
        title: "Fjalëkalimi u rivendos",
        description: "Fjalëkalimi i përdoruesit u rivendos me sukses.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Gabim në rivendosjen e fjalëkalimit",
        description: error.message || "Ndodhi një gabim gjatë rivendosjes së fjalëkalimit.",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const handleUpdateUser = (data: UpdateUserForm) => {
    if (!selectedUser) return;
    updateUserMutation.mutate({ ...data, id: selectedUser.id });
  };

  const handlePasswordReset = (data: PasswordResetForm) => {
    if (!selectedUser) return;
    passwordResetMutation.mutate({ ...data, id: selectedUser.id });
  };

  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    updateForm.reset({
      username: user.username,
      email: user.email || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role,
      isActive: user.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handlePasswordDialog = (user: AdminUser) => {
    setSelectedUser(user);
    passwordForm.reset();
    setIsPasswordDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sq-AL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Gabim në ngarkimin e përdoruesve: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" data-testid="page-user-management">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-8 h-8" />
            Menaxhimi i Përdoruesve
          </h1>
          <p className="text-muted-foreground mt-2">
            Menaxhoni përdoruesit e sistemit dhe rolet e tyre
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-user">
          <Plus className="w-4 h-4 mr-2" />
          Shto Përdorues
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Përdoruesit e Sistemit</CardTitle>
          <CardDescription>
            Lista e të gjithë përdoruesve të sistemit dhe informacionet e tyre
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Përdoruesi</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roli</TableHead>
                  <TableHead>Statusi</TableHead>
                  <TableHead>Data e Krijimit</TableHead>
                  <TableHead>Veprimet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        {(user.firstName || user.lastName) && (
                          <div className="text-sm text-muted-foreground">
                            {user.firstName} {user.lastName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role === "admin" ? "Administratori" : "Përdoruesi"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "destructive"}>
                        {user.isActive ? "Aktiv" : "Jo aktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-user-actions-${user.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Përditëso
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePasswordDialog(user)}>
                            <Key className="w-4 h-4 mr-2" />
                            Rivendos Fjalëkalimin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Krijo Përdorues të Ri</DialogTitle>
            <DialogDescription>
              Shtoni një përdorues të ri në sistem
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emri i Përdoruesit</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-create-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fjalëkalimi</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" data-testid="input-create-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (opsional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-create-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emri (opsional)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-create-firstname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mbiemri (opsional)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-create-lastname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roli</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-create-role">
                          <SelectValue placeholder="Zgjidhni rolin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">Përdoruesi</SelectItem>
                        <SelectItem value="admin">Administratori</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Anulo
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-create-user-submit">
                  {createUserMutation.isPending ? "Duke krijuar..." : "Krijo Përdoruesin"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Përditëso Përdoruesin</DialogTitle>
            <DialogDescription>
              Përditësoni informacionet e përdoruesit
            </DialogDescription>
          </DialogHeader>
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit(handleUpdateUser)} className="space-y-4">
              <FormField
                control={updateForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emri i Përdoruesit</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-edit-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emri</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-firstname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mbiemri</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-lastname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={updateForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roli</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">Përdoruesi</SelectItem>
                        <SelectItem value="admin">Administratori</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statusi</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Aktiv</SelectItem>
                        <SelectItem value="0">Jo aktiv</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Anulo
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-edit-user-submit">
                  {updateUserMutation.isPending ? "Duke përditësuar..." : "Përditëso"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rivendos Fjalëkalimin</DialogTitle>
            <DialogDescription>
              Vendosni një fjalëkalim të ri për përdoruesin {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordReset)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fjalëkalimi i Ri</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" data-testid="input-new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                  Anulo
                </Button>
                <Button type="submit" disabled={passwordResetMutation.isPending} data-testid="button-reset-password-submit">
                  {passwordResetMutation.isPending ? "Duke rivendosur..." : "Rivendos Fjalëkalimin"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
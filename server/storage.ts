import { 
  type Client, 
  type InsertClient,
  type Service,
  type InsertService,
  type Invoice,
  type InsertInvoice,
  type InvoiceService,
  type InsertInvoiceService,
  type InvoiceWithServices,
  type ClientService,
  type InsertClientService,
  type PaymentStatus,
  type User,
  type UpsertUser,
  type InsertUser,
  type CreateUser,
  type UpdateUser,
  type UserRole,
  clients,
  services,
  clientServices,
  invoices,
  invoiceServices,
  users
} from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, lt, gte, lte, ne, sql, inArray } from "drizzle-orm";

const connection = neon(process.env.DATABASE_URL!);
const db = drizzle(connection);

export interface IStorage {
  // User operations - Extended for custom authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User | undefined>;
  setUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  setUserRole(id: string, role: UserRole): Promise<User | undefined>;
  deactivateUser(id: string): Promise<User | undefined>;
  listUsers(): Promise<User[]>;
  // Legacy method for compatibility
  upsertUser(user: UpsertUser): Promise<User>;

  // Client operations
  getClient(id: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // Service operations
  getService(id: string): Promise<Service | undefined>;
  getAllServices(): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;
  
  // Client-Service relationships
  getClientServices(clientId: string): Promise<ClientService[]>;
  assignServiceToClient(assignment: InsertClientService): Promise<ClientService>;
  removeServiceFromClient(clientId: string, serviceId: string): Promise<boolean>;
  
  // Invoice operations - updated for multiple services support
  getInvoice(id: string): Promise<InvoiceWithServices | undefined>;
  getAllInvoices(): Promise<InvoiceWithServices[]>;
  getInvoicesByClient(clientId: string): Promise<InvoiceWithServices[]>;
  createInvoice(invoice: InsertInvoice): Promise<InvoiceWithServices>;
  updateInvoiceStatus(id: string, status: PaymentStatus, paidDate?: Date): Promise<Invoice | undefined>;
  getOverdueInvoices(): Promise<InvoiceWithServices[]>;
  getUpcomingInvoices(days: number): Promise<InvoiceWithServices[]>;
  
  // Invoice services operations
  getInvoiceServices(invoiceId: string): Promise<(InvoiceService & { service: Service })[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private clients: Map<string, Client>;
  private services: Map<string, Service>;
  private clientServices: Map<string, ClientService>;
  private invoices: Map<string, Invoice>;
  private invoiceServices: Map<string, InvoiceService>; // New collection for invoice services

  constructor() {
    this.users = new Map();
    this.clients = new Map();
    this.services = new Map();
    this.clientServices = new Map();
    this.invoices = new Map();
    this.invoiceServices = new Map(); // Initialize new collection
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      passwordHash: insertUser.passwordHash,
      email: insertUser.email ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
      role: insertUser.role ?? 'user',
      isActive: insertUser.isActive ?? 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async setUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, passwordHash, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async setUserRole(id: string, role: UserRole): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, role, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deactivateUser(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, isActive: 0, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (userData.id && this.users.has(userData.id)) {
      const existing = this.users.get(userData.id)!;
      const updated = { ...existing, ...userData, updatedAt: new Date() };
      this.users.set(userData.id, updated);
      return updated;
    } else {
      const id = userData.id || randomUUID();
      const user: User = {
        ...userData,
        id,
        createdAt: userData.createdAt || new Date(),
        updatedAt: new Date()
      } as User;
      this.users.set(id, user);
      return user;
    }
  }

  // Client operations
  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getAllClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { 
      id,
      name: insertClient.name,
      email: insertClient.email,
      phone: insertClient.phone ?? null,
      address: insertClient.address ?? null,
      taxId: insertClient.taxId ?? null,
      isCompany: insertClient.isCompany ?? 0,
      createdAt: new Date() 
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;
    
    const updatedClient = { ...client, ...updateData };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Service operations
  async getService(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getAllServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = randomUUID();
    const service: Service = { 
      id,
      name: insertService.name,
      description: insertService.description ?? null,
      price: insertService.price,
      billingPeriod: insertService.billingPeriod,
      createdAt: new Date() 
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: string, updateData: Partial<InsertService>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;
    
    const updatedService = { ...service, ...updateData };
    this.services.set(id, updatedService);
    return updatedService;
  }

  async deleteService(id: string): Promise<boolean> {
    return this.services.delete(id);
  }

  // Client-Service relationships
  async getClientServices(clientId: string): Promise<ClientService[]> {
    return Array.from(this.clientServices.values()).filter(
      cs => cs.clientId === clientId && cs.isActive
    );
  }

  async assignServiceToClient(assignment: InsertClientService): Promise<ClientService> {
    const id = randomUUID();
    const clientService: ClientService = {
      ...assignment,
      id,
      startDate: assignment.startDate || new Date(),
      isActive: assignment.isActive ?? 1
    };
    this.clientServices.set(id, clientService);
    return clientService;
  }

  async removeServiceFromClient(clientId: string, serviceId: string): Promise<boolean> {
    const existing = Array.from(this.clientServices.entries()).find(
      ([_, cs]) => cs.clientId === clientId && cs.serviceId === serviceId
    );
    if (existing) {
      return this.clientServices.delete(existing[0]);
    }
    return false;
  }

  // Invoice operations
  async getInvoice(id: string): Promise<InvoiceWithServices | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    
    const services = await this.getInvoiceServices(invoice.id);
    return { ...invoice, services };
  }

  async getAllInvoices(): Promise<InvoiceWithServices[]> {
    const invoicesList = Array.from(this.invoices.values());
    
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  async getInvoicesByClient(clientId: string): Promise<InvoiceWithServices[]> {
    const invoicesList = Array.from(this.invoices.values()).filter(
      invoice => invoice.clientId === clientId
    );
    
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<InvoiceWithServices> {
    const id = randomUUID();
    
    // Generate next sequential invoice number
    const existingNumbers = Array.from(this.invoices.values())
      .map(inv => inv.invoiceNumber)
      .filter(num => num !== null && num !== undefined) as number[];
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const invoiceNumber = maxNumber + 1;
    
    // For MemStorage, simulate the dual-write structure using first service for legacy fields
    const firstService = insertInvoice.services[0];
    let totalAmount = 0;
    
    // Store invoice services in MemStorage for parity with DatabaseStorage
    const serviceDetailsWithLines: (InvoiceService & { service: Service })[] = [];
    
    // Calculate total from all services and build service lines
    for (const service of insertInvoice.services) {
      const serviceDetail = this.services.get(service.serviceId);
      if (!serviceDetail) {
        throw new Error(`Service not found: ${service.serviceId}`);
      }
      
      const unitPrice = service.unitPrice ? parseFloat(service.unitPrice) : parseFloat(serviceDetail.price);
      const lineTotal = unitPrice * service.quantity;
      totalAmount += lineTotal;
      
      const invoiceService: InvoiceService = {
        id: randomUUID(),
        invoiceId: id,
        serviceId: service.serviceId,
        quantity: service.quantity,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      };
      
      this.invoiceServices.set(invoiceService.id, invoiceService);
      serviceDetailsWithLines.push({
        ...invoiceService,
        service: serviceDetail,
      });
    }
    
    const invoice: Invoice = {
      id,
      clientId: insertInvoice.clientId,
      dueDate: insertInvoice.dueDate,
      invoiceNumber,
      issueDate: new Date(),
      status: insertInvoice.status || 'pending',
      paidDate: insertInvoice.paidDate || null,
      // Legacy fields for backward compatibility (matching DatabaseStorage behavior)
      serviceId: firstService.serviceId,
      amount: serviceDetailsWithLines[0].lineTotal, // Use first service amount to match DatabaseStorage
      // New field
      totalAmount: totalAmount.toFixed(2),
    };
    
    this.invoices.set(id, invoice);
    
    // Add integrity check for MemStorage parity with DatabaseStorage
    const calculatedTotal = serviceDetailsWithLines.reduce((sum, s) => sum + parseFloat(s.lineTotal), 0);
    const storedTotal = parseFloat(invoice.totalAmount);
    
    if (Math.abs(calculatedTotal - storedTotal) > 0.01) {
      throw new Error(`Total amount mismatch: calculated ${calculatedTotal}, stored ${storedTotal}`);
    }
    
    // Return with actual services data
    return { ...invoice, services: serviceDetailsWithLines };
  }

  async updateInvoiceStatus(id: string, status: PaymentStatus, paidDate?: Date): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    
    const updatedInvoice = {
      ...invoice,
      status,
      paidDate: status === 'paid' ? (paidDate || new Date()) : null
    };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async getOverdueInvoices(): Promise<InvoiceWithServices[]> {
    const now = new Date();
    const invoicesList = Array.from(this.invoices.values()).filter(
      invoice => new Date(invoice.dueDate) < now && invoice.status !== 'paid'
    );
    
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  async getUpcomingInvoices(days: number): Promise<InvoiceWithServices[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const invoicesList = Array.from(this.invoices.values()).filter(
      invoice => {
        const dueDate = new Date(invoice.dueDate);
        return dueDate >= now && dueDate <= futureDate && invoice.status !== 'paid';
      }
    );
    
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  // MemStorage implementation of getInvoiceServices with actual data
  async getInvoiceServices(invoiceId: string): Promise<(InvoiceService & { service: Service })[]> {
    const invoiceServicesList = Array.from(this.invoiceServices.values())
      .filter(invoiceService => invoiceService.invoiceId === invoiceId);
    
    const result: (InvoiceService & { service: Service })[] = [];
    for (const invoiceService of invoiceServicesList) {
      const service = this.services.get(invoiceService.serviceId);
      if (service) {
        result.push({
          ...invoiceService,
          service,
        });
      }
    }
    
    return result;
  }
}

export class DatabaseStorage implements IStorage {
  // User operations - Extended for custom authentication
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async setUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async setUserRole(id: string, role: UserRole): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deactivateUser(id: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async listUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Legacy method for compatibility
  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Client operations
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updatedClient] = await db.update(clients)
      .set(client)
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    try {
      // Use transaction for data consistency
      return await db.transaction(async (tx) => {
        // Get all invoices for this client
        const clientInvoices = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientId, id));
        const invoiceIds = clientInvoices.map(inv => inv.id);
        
        // Delete all invoice services for this client's invoices (batch operation)
        if (invoiceIds.length > 0) {
          await tx.delete(invoiceServices).where(
            inArray(invoiceServices.invoiceId, invoiceIds)
          );
        }
        
        // Delete all invoices for this client
        await tx.delete(invoices).where(eq(invoices.clientId, id));
        
        // Delete all client-service assignments for this client
        await tx.delete(clientServices).where(eq(clientServices.clientId, id));
        
        // Finally, delete the client
        const result = await tx.delete(clients).where(eq(clients.id, id));
        return result.rowCount > 0;
      });
    } catch (error) {
      console.error('Error deleting client:', error);
      return false;
    }
  }

  // Service operations
  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async getAllServices(): Promise<Service[]> {
    return await db.select().from(services);
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined> {
    const [updatedService] = await db.update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }

  async deleteService(id: string): Promise<boolean> {
    try {
      // Check if service is referenced by any invoices - prevent deletion to preserve historical data
      const referencedInvoices = await db.select().from(invoiceServices).where(eq(invoiceServices.serviceId, id));
      if (referencedInvoices.length > 0) {
        console.log(`Cannot delete service ${id}: referenced by ${referencedInvoices.length} invoice(s)`);
        return false;
      }
      
      // Delete all client-service assignments for this service
      await db.delete(clientServices).where(eq(clientServices.serviceId, id));
      
      // Finally, delete the service
      const result = await db.delete(services).where(eq(services.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting service:', error);
      return false;
    }
  }

  // Client-Service relationships
  async getClientServices(clientId: string): Promise<ClientService[]> {
    return await db.select().from(clientServices).where(
      and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.isActive, 1)
      )
    );
  }

  async assignServiceToClient(assignment: InsertClientService): Promise<ClientService> {
    const [newAssignment] = await db.insert(clientServices).values(assignment).returning();
    return newAssignment;
  }

  async removeServiceFromClient(clientId: string, serviceId: string): Promise<boolean> {
    const result = await db.delete(clientServices)
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.serviceId, serviceId)
      ));
    return result.rowCount > 0;
  }

  // Invoice operations
  async getInvoice(id: string): Promise<InvoiceWithServices | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return undefined;
    
    const services = await this.getInvoiceServices(invoice.id);
    return { ...invoice, services };
  }

  async getAllInvoices(): Promise<InvoiceWithServices[]> {
    const invoicesList = await db.select().from(invoices);
    
    // Fetch services for each invoice
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  async getInvoicesByClient(clientId: string): Promise<InvoiceWithServices[]> {
    const invoicesList = await db.select().from(invoices).where(eq(invoices.clientId, clientId));
    
    // Fetch services for each invoice
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  async createInvoice(invoice: InsertInvoice): Promise<InvoiceWithServices> {
    // Generate next sequential invoice number 
    const existingInvoices = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices);
    const existingNumbers = existingInvoices
      .map(inv => inv.invoiceNumber)
      .filter(num => num !== null && num !== undefined) as number[];
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    let invoiceNumber = maxNumber + 1;
    
    // Calculate totals and prepare service lines
    let totalAmount = 0;
    const serviceLines: InsertInvoiceService[] = [];
      
    for (const service of invoice.services) {
      // Get service details to determine unit price
      const [serviceDetails] = await db.select().from(services).where(eq(services.id, service.serviceId));
      if (!serviceDetails) {
        throw new Error(`Service not found: ${service.serviceId}`);
      }
      
      const unitPrice = service.unitPrice ? parseFloat(service.unitPrice) : parseFloat(serviceDetails.price);
      const lineTotal = unitPrice * service.quantity;
      totalAmount += lineTotal;
      
      serviceLines.push({
        serviceId: service.serviceId,
        quantity: service.quantity,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });
    }
    
    // Phase 3 dual-write: Write to both old and new structures with retry on unique violation
    let newInvoice: Invoice;
    let attempts = 0;
    const maxAttempts = 5;
      
    while (attempts < maxAttempts) {
      try {
        const invoiceData = {
          clientId: invoice.clientId,
          dueDate: invoice.dueDate,
          status: invoice.status || 'pending' as const,
          paidDate: invoice.paidDate,
          invoiceNumber,
          totalAmount: totalAmount.toFixed(2),
        };
        
        // Create the invoice record
        [newInvoice] = await db.insert(invoices).values(invoiceData).returning();
        break;
      } catch (error: any) {
        // Check if it's a unique constraint violation on invoice_number
        if (error?.code === '23505' && error?.constraint?.includes('invoice_number')) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(`Failed to create invoice after ${maxAttempts} attempts due to number conflicts`);
          }
          // Increment invoice number and retry
          invoiceNumber++;
          continue;
        }
        // If it's not a unique constraint violation, rethrow the error
        throw error;
      }
    }
    
    // Create invoice service records in the junction table
    for (const serviceLine of serviceLines) {
      await db.insert(invoiceServices).values({
        invoiceId: newInvoice.id,
        ...serviceLine,
      });
    }
    
    // Integrity check: Verify totalAmount equals sum of line totals
    const storedServices = await db
      .select({ lineTotal: invoiceServices.lineTotal })
      .from(invoiceServices)
      .where(eq(invoiceServices.invoiceId, newInvoice.id));
    
    const calculatedTotal = storedServices.reduce((sum, s) => sum + parseFloat(s.lineTotal), 0);
    const storedTotal = parseFloat(newInvoice.totalAmount);
    
    if (Math.abs(calculatedTotal - storedTotal) > 0.01) {
      throw new Error(`Total amount mismatch: calculated ${calculatedTotal}, stored ${storedTotal}`);
    }
    
    // Fetch services for the response
    const serviceRows = await db
      .select({
        id: invoiceServices.id,
        invoiceId: invoiceServices.invoiceId,
        serviceId: invoiceServices.serviceId,
        quantity: invoiceServices.quantity,
        unitPrice: invoiceServices.unitPrice,
        lineTotal: invoiceServices.lineTotal,
        service: {
          id: services.id,
          name: services.name,
          description: services.description,
          price: services.price,
          billingPeriod: services.billingPeriod,
          createdAt: services.createdAt,
        }
      })
      .from(invoiceServices)
      .innerJoin(services, eq(invoiceServices.serviceId, services.id))
      .where(eq(invoiceServices.invoiceId, newInvoice.id));
    
    return { ...newInvoice, services: serviceRows };
  }

  async updateInvoiceStatus(id: string, status: PaymentStatus, paidDate?: Date): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db.update(invoices)
      .set({
        status,
        paidDate: status === 'paid' ? (paidDate || new Date()) : null
      })
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async getOverdueInvoices(): Promise<InvoiceWithServices[]> {
    const now = new Date();
    const invoicesList = await db.select().from(invoices)
      .where(and(
        lt(invoices.dueDate, now),
        ne(invoices.status, 'paid')
      ));
    
    // Fetch services for each invoice
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  async getUpcomingInvoices(days: number): Promise<InvoiceWithServices[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const invoicesList = await db.select().from(invoices)
      .where(and(
        gte(invoices.dueDate, now),
        lte(invoices.dueDate, futureDate),
        ne(invoices.status, 'paid')
      ));
    
    // Fetch services for each invoice
    const result: InvoiceWithServices[] = [];
    for (const invoice of invoicesList) {
      const services = await this.getInvoiceServices(invoice.id);
      result.push({ ...invoice, services });
    }
    return result;
  }

  // New method to fetch invoice services with service details
  async getInvoiceServices(invoiceId: string): Promise<(InvoiceService & { service: Service })[]> {
    return await db
      .select({
        id: invoiceServices.id,
        invoiceId: invoiceServices.invoiceId,
        serviceId: invoiceServices.serviceId,
        quantity: invoiceServices.quantity,
        unitPrice: invoiceServices.unitPrice,
        lineTotal: invoiceServices.lineTotal,
        service: {
          id: services.id,
          name: services.name,
          description: services.description,
          price: services.price,
          billingPeriod: services.billingPeriod,
          createdAt: services.createdAt,
        }
      })
      .from(invoiceServices)
      .innerJoin(services, eq(invoiceServices.serviceId, services.id))
      .where(eq(invoiceServices.invoiceId, invoiceId));
  }
}

export const storage = new DatabaseStorage();

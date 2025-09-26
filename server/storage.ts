import { 
  type Client, 
  type InsertClient,
  type Service,
  type InsertService,
  type Invoice,
  type InsertInvoice,
  type ClientService,
  type InsertClientService,
  type PaymentStatus
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
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
  
  // Invoice operations
  getInvoice(id: string): Promise<Invoice | undefined>;
  getAllInvoices(): Promise<Invoice[]>;
  getInvoicesByClient(clientId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoiceStatus(id: string, status: PaymentStatus, paidDate?: Date): Promise<Invoice | undefined>;
  getOverdueInvoices(): Promise<Invoice[]>;
  getUpcomingInvoices(days: number): Promise<Invoice[]>;
}

export class MemStorage implements IStorage {
  private clients: Map<string, Client>;
  private services: Map<string, Service>;
  private clientServices: Map<string, ClientService>;
  private invoices: Map<string, Invoice>;

  constructor() {
    this.clients = new Map();
    this.services = new Map();
    this.clientServices = new Map();
    this.invoices = new Map();
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
  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      invoice => invoice.clientId === clientId
    );
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const invoice: Invoice = {
      ...insertInvoice,
      id,
      issueDate: new Date(),
      status: insertInvoice.status || 'pending',
      paidDate: insertInvoice.paidDate || null
    };
    this.invoices.set(id, invoice);
    return invoice;
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

  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    return Array.from(this.invoices.values()).filter(
      invoice => new Date(invoice.dueDate) < now && invoice.status !== 'paid'
    );
  }

  async getUpcomingInvoices(days: number): Promise<Invoice[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return Array.from(this.invoices.values()).filter(
      invoice => {
        const dueDate = new Date(invoice.dueDate);
        return dueDate >= now && dueDate <= futureDate && invoice.status !== 'paid';
      }
    );
  }
}

export const storage = new MemStorage();

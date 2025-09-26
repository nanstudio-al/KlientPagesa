import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertServiceSchema, insertInvoiceSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./replitAuth";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for correct IP handling behind reverse proxy/CDN
  app.set('trust proxy', 1);

  // Security hardening - add security headers with environment-aware CSP
  const isDevelopment = process.env.NODE_ENV === 'development';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: isDevelopment 
          ? ["'self'", "'unsafe-inline'", "fonts.googleapis.com"] // Allow inline styles and Google Fonts for Vite dev
          : ["'self'", "fonts.googleapis.com"], 
        scriptSrc: isDevelopment 
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Allow inline scripts and eval for Vite dev
          : ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: isDevelopment 
          ? ["'self'", "wss:", "ws:"] // Allow WebSocket for Vite HMR
          : ["'self'"],
        fontSrc: ["'self'", "fonts.gstatic.com"], // For Google Fonts
        frameAncestors: ["'none'"], // Prevent clickjacking
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: !isDevelopment ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    } : false, // Only in production
  }));

  // Rate limiting - protect API endpoints from abuse
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: "Too many requests from this IP, please try again later."
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for auth callback endpoints (they may have different patterns)
    skip: (req) => {
      const authCallbackPaths = ['/api/login', '/api/callback', '/api/logout'];
      try {
        const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
        return authCallbackPaths.some(path => url.pathname.startsWith(path));
      } catch {
        // Fallback to original logic if URL parsing fails
        return authCallbackPaths.includes(req.originalUrl);
      }
    },
  });

  // Apply rate limiting to all /api/* routes
  app.use('/api', apiLimiter);

  // CSRF protection for state-changing requests using Origin/Referer checks
  app.use('/api', (req, res, next) => {
    const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    
    if (stateChangingMethods.includes(req.method)) {
      const origin = req.get('Origin');
      const referer = req.get('Referer');
      
      // Build allowed origins list
      const allowedOrigins = [];
      
      // Always allow same-origin (current request origin)
      const currentOrigin = `${req.protocol}://${req.get('host')}`;
      allowedOrigins.push(currentOrigin);
      
      // Add REPLIT_DOMAINS if available
      if (process.env.REPLIT_DOMAINS) {
        process.env.REPLIT_DOMAINS.split(',').forEach(domain => {
          allowedOrigins.push(`https://${domain.trim()}`);
        });
      }
      
      // For development, also allow common dev origins
      if (isDevelopment) {
        allowedOrigins.push('http://localhost:5000', 'https://localhost:5000');
      }
      
      // Check if Origin header matches allowed origins
      if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'Forbidden: Invalid origin' });
      }
      
      // If no Origin header, check Referer as fallback
      if (!origin && referer) {
        try {
          const refererUrl = new URL(referer);
          const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
          if (!allowedOrigins.includes(refererOrigin)) {
            return res.status(403).json({ error: 'Forbidden: Invalid referer' });
          }
        } catch {
          return res.status(403).json({ error: 'Forbidden: Invalid referer format' });
        }
      }
      
      // If neither Origin nor Referer is present for state-changing requests, reject
      if (!origin && !referer) {
        return res.status(403).json({ error: 'Forbidden: Missing origin/referer headers' });
      }
    }
    
    next();
  });

  // Auth middleware - from Replit Auth integration
  await setupAuth(app);

  // Protected API routes - all routes under /api/* require authentication except auth flow routes
  app.use('/api', (req, res, next) => {
    // Whitelist auth flow routes that should be public
    const publicRoutes = ['/api/login', '/api/callback', '/api/logout'];
    if (publicRoutes.includes(req.path)) {
      return next();
    }
    // All other /api/* routes require authentication
    return isAuthenticated(req, res, next);
  });

  // Auth routes - from Replit Auth integration  
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      
      // Enrich with additional data for the frontend
      const enrichedClients = await Promise.all(
        clients.map(async (client) => {
          const clientServices = await storage.getClientServices(client.id);
          const invoices = await storage.getInvoicesByClient(client.id);
          
          const services = await Promise.all(
            clientServices.map(cs => storage.getService(cs.serviceId))
          );
          
          const totalPending = invoices
            .filter(inv => inv.status === 'pending')
            .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
          
          const overdueCount = invoices.filter(inv => {
            return new Date(inv.dueDate) < new Date() && inv.status !== 'paid';
          }).length;
          
          return {
            ...client,
            services: services.filter(Boolean).map(s => s!.name),
            totalPending,
            overdueCount
          };
        })
      );
      
      res.json(enrichedClients);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create client' });
      }
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch client' });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const validatedData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, validatedData);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update client' });
      }
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const success = await storage.deleteClient(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete client' });
    }
  });

  // Service routes
  app.get("/api/services", async (req, res) => {
    try {
      const services = await storage.getAllServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  app.post("/api/services", async (req, res) => {
    try {
      const validatedData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(validatedData);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create service' });
      }
    }
  });

  app.get("/api/services/:id", async (req, res) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch service' });
    }
  });

  app.put("/api/services/:id", async (req, res) => {
    try {
      const validatedData = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(req.params.id, validatedData);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update service' });
      }
    }
  });

  app.delete("/api/services/:id", async (req, res) => {
    try {
      const success = await storage.deleteService(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Service not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete service' });
    }
  });

  // Invoice routes
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      
      // Enrich with client and service names
      const enrichedInvoices = await Promise.all(
        invoices.map(async (invoice) => {
          const client = await storage.getClient(invoice.clientId);
          const service = await storage.getService(invoice.serviceId);
          
          return {
            ...invoice,
            clientName: client?.name || 'Unknown Client',
            serviceName: service?.name || 'Unknown Service'
          };
        })
      );
      
      res.json(enrichedInvoices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      // Only log in development - avoid sensitive data in production logs
      if (isDevelopment) {
        console.log("Invoice creation request body:", JSON.stringify(req.body, null, 2));
      }
      const validatedData = insertInvoiceSchema.parse(req.body);
      if (isDevelopment) {
        console.log("Validated invoice data:", JSON.stringify(validatedData, null, 2));
      }
      const invoice = await storage.createInvoice(validatedData);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Invoice creation error:", error);
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", JSON.stringify(error.errors, null, 2));
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create invoice' });
      }
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch invoice' });
    }
  });

  app.patch("/api/invoices/:id/status", async (req, res) => {
    try {
      const { status, paidDate } = req.body;
      const invoice = await storage.updateInvoiceStatus(
        req.params.id, 
        status, 
        paidDate ? new Date(paidDate) : undefined
      );
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update invoice status' });
    }
  });

  // Dashboard analytics routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      const services = await storage.getAllServices();
      const invoices = await storage.getAllInvoices();
      const overdueInvoices = await storage.getOverdueInvoices();
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const monthlyRevenue = invoices
        .filter(inv => {
          const invoiceDate = new Date(inv.issueDate);
          return invoiceDate.getMonth() === currentMonth && 
                 invoiceDate.getFullYear() === currentYear &&
                 inv.status === 'paid';
        })
        .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
      
      const pendingAmount = invoices
        .filter(inv => inv.status === 'pending')
        .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
      
      const stats = {
        totalClients: clients.length,
        activeServices: services.length,
        pendingInvoices: invoices.filter(inv => inv.status === 'pending').length,
        overdueInvoices: overdueInvoices.length,
        monthlyRevenue: Math.round(monthlyRevenue),
        pendingAmount: Math.round(pendingAmount)
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  app.get("/api/dashboard/recent-invoices", async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      const recentInvoices = invoices
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
        .slice(0, 5);
      
      const enrichedInvoices = await Promise.all(
        recentInvoices.map(async (invoice) => {
          const client = await storage.getClient(invoice.clientId);
          const service = await storage.getService(invoice.serviceId);
          
          return {
            id: invoice.id,
            clientName: client?.name || 'Unknown',
            serviceName: service?.name || 'Unknown',
            amount: invoice.amount,
            dueDate: invoice.dueDate,
            status: invoice.status
          };
        })
      );
      
      res.json(enrichedInvoices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch recent invoices' });
    }
  });

  app.get("/api/dashboard/upcoming-payments", async (req, res) => {
    try {
      const upcomingInvoices = await storage.getUpcomingInvoices(30);
      
      const enrichedInvoices = await Promise.all(
        upcomingInvoices.map(async (invoice) => {
          const client = await storage.getClient(invoice.clientId);
          const service = await storage.getService(invoice.serviceId);
          
          return {
            id: invoice.id,
            clientName: client?.name || 'Unknown',
            serviceName: service?.name || 'Unknown',
            amount: invoice.amount,
            dueDate: invoice.dueDate
          };
        })
      );
      
      res.json(enrichedInvoices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch upcoming payments' });
    }
  });

  // Reports routes
  app.get("/api/reports/monthly-stats", async (req, res) => {
    try {
      const allInvoices = await storage.getAllInvoices();
      const allClients = await storage.getAllClients();
      
      // Get current month stats
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const currentMonthInvoices = allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.issueDate);
        return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
      });
      
      const currentMonthRevenue = currentMonthInvoices
        .filter(invoice => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + parseFloat(invoice.amount as string), 0);
      
      // Get previous month stats for comparison
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      
      const prevMonthInvoices = allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.issueDate);
        return invoiceDate.getMonth() === prevMonth && invoiceDate.getFullYear() === prevYear;
      });
      
      const prevMonthRevenue = prevMonthInvoices
        .filter(invoice => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + parseFloat(invoice.amount as string), 0);
      
      const revenueGrowth = prevMonthRevenue > 0 ? 
        ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue * 100).toFixed(1) : '0';
      
      // Calculate pending revenue as well
      const currentMonthPendingRevenue = currentMonthInvoices
        .filter(invoice => invoice.status === 'pending')
        .reduce((sum, invoice) => sum + parseFloat(invoice.amount as string), 0);
      
      res.json({
        currentMonthRevenue: Math.round(currentMonthRevenue),
        currentMonthPendingRevenue: Math.round(currentMonthPendingRevenue),
        currentMonthInvoices: currentMonthInvoices.length,
        totalClients: allClients.length,
        revenueGrowth: parseFloat(revenueGrowth)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch monthly stats' });
    }
  });

  app.get("/api/reports/top-services", async (req, res) => {
    try {
      const allInvoices = await storage.getAllInvoices();
      const allServices = await storage.getAllServices();
      
      // Group invoices by service and calculate revenue
      const serviceStats = new Map();
      
      for (const invoice of allInvoices) {
        if (invoice.status === 'paid') {
          const serviceId = invoice.serviceId;
          if (!serviceStats.has(serviceId)) {
            serviceStats.set(serviceId, {
              revenue: 0,
              clients: new Set(),
              invoiceCount: 0
            });
          }
          const stats = serviceStats.get(serviceId);
          stats.revenue += parseFloat(invoice.amount as string);
          stats.clients.add(invoice.clientId);
          stats.invoiceCount++;
        }
      }
      
      // Get service details and sort by revenue
      const topServices = [];
      for (const service of allServices) {
        const stats = serviceStats.get(service.id) || { revenue: 0, clients: new Set(), invoiceCount: 0 };
        topServices.push({
          name: service.name,
          revenue: Math.round(stats.revenue),
          clients: stats.clients.size,
          growth: '+0%' // Simplified for now
        });
      }
      
      topServices.sort((a, b) => b.revenue - a.revenue);
      
      res.json(topServices.slice(0, 5)); // Top 5 services
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch top services' });
    }
  });

  app.get("/api/reports/overdue-payments", async (req, res) => {
    try {
      const overdueInvoices = await storage.getOverdueInvoices();
      const allClients = await storage.getAllClients();
      
      const overduePayments = [];
      for (const invoice of overdueInvoices) {
        const client = allClients.find(c => c.id === invoice.clientId);
        if (client) {
          const daysDue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          overduePayments.push({
            clientName: client.name,
            amount: Math.round(parseFloat(invoice.amount as string)),
            daysDue,
            invoiceId: invoice.id
          });
        }
      }
      
      res.json(overduePayments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch overdue payments' });
    }
  });

  // Client-Service assignment routes
  app.post("/api/clients/:clientId/services", async (req, res) => {
    try {
      const { serviceId, startDate } = req.body;
      const assignment = await storage.assignServiceToClient({
        clientId: req.params.clientId,
        serviceId,
        startDate: startDate ? new Date(startDate) : undefined,
        isActive: 1
      });
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: 'Failed to assign service to client' });
    }
  });

  app.delete("/api/clients/:clientId/services/:serviceId", async (req, res) => {
    try {
      const success = await storage.removeServiceFromClient(
        req.params.clientId, 
        req.params.serviceId
      );
      if (!success) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove service from client' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

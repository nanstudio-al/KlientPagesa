import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertServiceSchema, insertInvoiceSchema, loginSchema, type User, type UserRole } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
const pgSession = connectPgSimple(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for correct IP handling behind reverse proxy/CDN

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
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://replit.com"] // Allow inline scripts, eval and Replit dev banner
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
    // Skip rate limiting for auth endpoints
    skip: (req) => {
      const authPaths = ['/api/auth/login', '/api/auth/logout'];
      try {
        const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
        return authPaths.some(path => url.pathname.startsWith(path));
      } catch {
        // Fallback to original logic if URL parsing fails
        return authPaths.includes(req.originalUrl);
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
      
      // For development, also allow common dev origins and Replit patterns
      if (isDevelopment) {
        allowedOrigins.push('http://localhost:5000', 'https://localhost:5000');
        
        // Add Replit development URL patterns
        const host = req.get('host');
        if (host && host.includes('.replit.dev')) {
          allowedOrigins.push(`https://${host}`);
          allowedOrigins.push(`http://${host}`);
        }
      }
      
      // Debug logging for CSRF protection in development
      if (isDevelopment) {
        console.log('CSRF Debug:', {
          origin,
          referer,
          currentOrigin,
          allowedOrigins,
          host: req.get('host')
        });
      }
      
      // Check if Origin header matches allowed origins
      if (origin && !allowedOrigins.includes(origin)) {
        console.error('CSRF: Origin not allowed:', { origin, allowedOrigins });
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

  // Validate required environment variables
  if (!process.env.SESSION_SECRET) {
    console.error('FATAL: SESSION_SECRET environment variable is required');
    process.exit(1);
  }

  // Session configuration for custom authentication
  app.use(session({
    store: new pgSession({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: 'sessions',
      createTableIfMissing: isDevelopment, // Allow table creation in development
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: !isDevelopment, // HTTPS only in production
      httpOnly: true, // Prevent XSS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // CSRF protection
      // Don't set domain explicitly to allow cookies to work on custom domains
      // The browser will set it to the current domain automatically
    },
    name: 'sessionId',
    // Trust proxy for custom domain support
    proxy: !isDevelopment
  }));

  // Custom authentication middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session && req.session.user) {
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized' });
  };

  // Role-based access control middleware
  const requireRole = (role: UserRole) => {
    return async (req: any, res: any, next: any) => {
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Fetch fresh user data to check current role
      const user = await storage.getUser(req.session.user.id);
      if (!user || user.role !== role || !user.isActive) {
        return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
      }
      
      next();
    };
  };

  // Protected API routes - all routes under /api/* require authentication except auth routes
  app.use('/api', (req, res, next) => {
    // Whitelist public auth routes (req.path excludes the mounted path /api)
    const publicRoutes = ['/auth/login'];
    if (publicRoutes.includes(req.path)) {
      return next();
    }
    // All other /api/* routes require authentication
    return isAuthenticated(req, res, next);
  });

  // Strict rate limiting for login attempts
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per window
    message: {
      error: "Too many login attempts from this IP, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Custom authentication routes
  app.post('/api/auth/login', loginLimiter, async (req: any, res) => {
    try {
      // Only log in development - avoid sensitive data in production logs
      if (isDevelopment) {
        console.log("Login attempt for:", req.body.username);
      }
      
      const validatedData = loginSchema.parse(req.body);
      const { username, password } = validatedData;
      
      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Create session
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };
      
      // Regenerate session ID for security
      req.session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ message: 'Login failed' });
        }
        
        req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        };
        
        res.json({ 
          message: 'Login successful',
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          }
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          details: isDevelopment ? error.errors : undefined 
        });
      }
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req: any, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('sessionId');
        res.status(204).send();
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.get('/api/auth/me', async (req: any, res) => {
    try {
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Fetch fresh user data from database
      const user = await storage.getUser(req.session.user.id);
      if (!user || !user.isActive) {
        // Clear invalid session
        req.session.destroy((err: any) => {
          if (err) console.error('Session cleanup error:', err);
        });
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Admin user management routes (admin-only)
  app.get('/api/admin/users', requireRole('admin'), async (req: any, res) => {
    try {
      const users = await storage.listUsers();
      // Remove sensitive data from response
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post('/api/admin/users', requireRole('admin'), async (req: any, res) => {
    try {
      const { username, password, email, firstName, lastName, role } = req.body;
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user
      const newUser = await storage.createUser({
        username,
        passwordHash,
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || 'user',
        isActive: 1
      });
      
      // Return safe user data (no password hash)
      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.patch('/api/admin/users/:id', requireRole('admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { username, email, firstName, lastName, role, isActive } = req.body;
      
      // Prevent self-demotion
      const currentUser = req.session.user;
      if (id === currentUser.id && role !== 'admin') {
        return res.status(400).json({ message: 'Cannot demote yourself from admin' });
      }
      
      // Prevent self-deactivation
      if (id === currentUser.id && isActive === 0) {
        return res.status(400).json({ message: 'Cannot deactivate your own account' });
      }
      
      const updatedUser = await storage.updateUser(id, {
        username,
        email,
        firstName,
        lastName,
        role,
        isActive
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Return safe user data
      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        updatedAt: updatedUser.updatedAt
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  app.post('/api/admin/users/:id/password', requireRole('admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      
      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12);
      
      const updatedUser = await storage.setUserPassword(id, passwordHash);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Failed to reset password' });
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

  // Invoice PDF download endpoint
  app.get("/api/invoices/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get client and service details
      const client = await storage.getClient(invoice.clientId);
      const service = await storage.getService(invoice.serviceId);
      
      if (!client || !service) {
        return res.status(404).json({ error: 'Client or service not found' });
      }

      // Generate HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Fatura ${invoice.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .invoice-number { font-size: 24px; font-weight: bold; color: #333; }
            .client-info, .invoice-details { margin-bottom: 30px; }
            .label { font-weight: bold; color: #555; }
            .amount { font-size: 20px; font-weight: bold; color: #2563eb; }
            .status { padding: 4px 12px; border-radius: 4px; color: white; }
            .status.paid { background-color: #16a34a; }
            .status.pending { background-color: #f59e0b; }
            .status.overdue { background-color: #dc2626; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="invoice-number">FATURA #${invoice.id.slice(-8).toUpperCase()}</div>
            <p>Data e lëshimit: ${new Date(invoice.issueDate).toLocaleDateString('sq-AL')}</p>
            <p>Skadenca: ${new Date(invoice.dueDate).toLocaleDateString('sq-AL')}</p>
          </div>
          
          <div class="client-info">
            <h3>Faturuar për:</h3>
            <p><span class="label">Klienti:</span> ${client.name}</p>
            <p><span class="label">Email:</span> ${client.email}</p>
            ${client.phone ? `<p><span class="label">Telefoni:</span> ${client.phone}</p>` : ''}
            ${client.address ? `<p><span class="label">Adresa:</span> ${client.address}</p>` : ''}
            ${client.taxId ? `<p><span class="label">Numri Fiskal:</span> ${client.taxId}</p>` : ''}
          </div>
          
          <div class="invoice-details">
            <h3>Detajet e shërbimit:</h3>
            <p><span class="label">Shërbimi:</span> ${service.name}</p>
            <p><span class="label">Përshkrimi:</span> ${service.description || 'N/A'}</p>
            <p><span class="label">Çmimi:</span> <span class="amount">${invoice.amount}€</span></p>
            <p><span class="label">Statusi:</span> 
              <span class="status ${invoice.status}">
                ${invoice.status === 'paid' ? 'Paguar' : invoice.status === 'pending' ? 'Në pritje' : 'Vonesa'}
              </span>
            </p>
            ${invoice.paidDate ? `<p><span class="label">Data e pagesës:</span> ${new Date(invoice.paidDate).toLocaleDateString('sq-AL')}</p>` : ''}
          </div>
          
          <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px;">
            <p>Ky dokument është gjeneruar automatikisht nga sistemi i menaxhimit të klientëve</p>
          </div>
        </body>
        </html>
      `;

      // Return formatted HTML for browser PDF generation (more reliable than server-side Puppeteer)
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="fatura-${invoice.id.slice(-8)}.html"`);
      
      // Enhanced HTML with modern design and logo
      const printableHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Fatura ${invoice.id}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              background: white;
              padding: 40px;
            }
            
            .print-actions { 
              margin-bottom: 30px;
              text-align: center;
              background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
              padding: 20px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
            }
            
            .print-actions button { 
              background: white;
              color: #1d4ed8;
              border: none;
              padding: 14px 28px;
              border-radius: 8px;
              margin: 0 10px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              transition: all 0.2s ease;
            }
            
            .print-actions button:hover { 
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .print-actions button.secondary { 
              background: transparent;
              color: white;
              border: 2px solid white;
            }
            
            .print-actions button.secondary:hover { 
              background: white;
              color: #1d4ed8;
            }
            
            .invoice-container {
              background: white;
              border-radius: 16px;
              box-shadow: 0 4px 25px rgba(0, 0, 0, 0.08);
              overflow: hidden;
            }
            
            .invoice-header {
              background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
              color: white;
              padding: 40px;
              position: relative;
            }
            
            .logo-section {
              display: flex;
              align-items: center;
              gap: 20px;
              margin-bottom: 30px;
            }
            
            .logo-placeholder {
              width: 120px;
              height: 60px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              border: 2px dashed rgba(255, 255, 255, 0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              color: rgba(255, 255, 255, 0.8);
            }
            
            .company-info h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            
            .company-info p {
              font-size: 16px;
              opacity: 0.9;
            }
            
            .invoice-meta {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-top: 30px;
            }
            
            .invoice-number {
              font-size: 32px;
              font-weight: 800;
              margin-bottom: 10px;
            }
            
            .invoice-dates {
              text-align: right;
            }
            
            .date-item {
              margin-bottom: 8px;
            }
            
            .date-label {
              font-size: 14px;
              opacity: 0.8;
              display: block;
            }
            
            .date-value {
              font-size: 16px;
              font-weight: 600;
            }
            
            .invoice-body {
              padding: 40px;
            }
            
            .billing-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-bottom: 40px;
              padding: 30px;
              background: #f8fafc;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            
            .section-title {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #0ea5e9;
            }
            
            .info-item {
              display: flex;
              margin-bottom: 12px;
            }
            
            .info-label {
              font-weight: 600;
              color: #475569;
              min-width: 120px;
            }
            
            .info-value {
              color: #1e293b;
              flex: 1;
            }
            
            .service-details {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              overflow: hidden;
              margin-bottom: 40px;
            }
            
            .service-header {
              background: #0ea5e9;
              color: white;
              padding: 20px;
              font-size: 18px;
              font-weight: 700;
            }
            
            .service-content {
              padding: 30px;
            }
            
            .service-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 15px 0;
              border-bottom: 1px solid #f1f5f9;
            }
            
            .service-item:last-child {
              border-bottom: none;
            }
            
            .service-name {
              font-size: 16px;
              font-weight: 600;
              color: #1e293b;
            }
            
            .service-description {
              font-size: 14px;
              color: #64748b;
              margin-top: 4px;
            }
            
            .amount {
              font-size: 24px;
              font-weight: 800;
              color: #0ea5e9;
            }
            
            .status {
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .status.paid {
              background: #dcfce7;
              color: #166534;
            }
            
            .status.pending {
              background: #fef3c7;
              color: #92400e;
            }
            
            .status.overdue {
              background: #fee2e2;
              color: #991b1b;
            }
            
            .footer {
              text-align: center;
              padding: 30px;
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
              margin-top: 40px;
            }
            
            .footer-text {
              color: #64748b;
              font-size: 14px;
              line-height: 1.5;
            }
            
            .footer-logo {
              margin-top: 20px;
              font-weight: 600;
              color: #0ea5e9;
            }
            
            @media print {
              .print-actions { display: none !important; }
              body { padding: 20px; }
              .invoice-container { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button id="print-btn">📄 Printo si PDF</button>
            <button id="close-btn" class="secondary">❌ Mbyll</button>
          </div>
          
          <div class="invoice-container">
            <div class="invoice-header">
              <div class="logo-section">
                <div class="logo-placeholder">NaN Studio</div>
                <div class="company-info">
                  <h1>NaN Studio</h1>
                  <p>Professional Technology Services</p>
                </div>
              </div>
              
              <div class="invoice-meta">
                <div class="invoice-number-section">
                  <div class="invoice-number">FATURA #${invoice.id.slice(-8).toUpperCase()}</div>
                </div>
                <div class="invoice-dates">
                  <div class="date-item">
                    <span class="date-label">Data e lëshimit:</span>
                    <span class="date-value">${new Date(invoice.issueDate).toLocaleDateString('sq-AL')}</span>
                  </div>
                  <div class="date-item">
                    <span class="date-label">Skadenca:</span>
                    <span class="date-value">${new Date(invoice.dueDate).toLocaleDateString('sq-AL')}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="invoice-body">
              <div class="billing-section">
                <div>
                  <h3 class="section-title">Faturuar për:</h3>
                  <div class="info-item">
                    <span class="info-label">Klienti:</span>
                    <span class="info-value">${client.name}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${client.email}</span>
                  </div>
                  ${client.phone ? `
                    <div class="info-item">
                      <span class="info-label">Telefoni:</span>
                      <span class="info-value">${client.phone}</span>
                    </div>
                  ` : ''}
                  ${client.address ? `
                    <div class="info-item">
                      <span class="info-label">Adresa:</span>
                      <span class="info-value">${client.address}</span>
                    </div>
                  ` : ''}
                  ${client.taxId ? `
                    <div class="info-item">
                      <span class="info-label">Numri Fiskal:</span>
                      <span class="info-value">${client.taxId}</span>
                    </div>
                  ` : ''}
                </div>
                
                <div>
                  <h3 class="section-title">Statusi i Pagesës:</h3>
                  <div class="info-item">
                    <span class="info-label">Statusi:</span>
                    <span class="status ${invoice.status}">
                      ${invoice.status === 'paid' ? 'Paguar' : invoice.status === 'pending' ? 'Në pritje' : 'Vonesa'}
                    </span>
                  </div>
                  ${invoice.paidDate ? `
                    <div class="info-item">
                      <span class="info-label">Data e pagesës:</span>
                      <span class="info-value">${new Date(invoice.paidDate).toLocaleDateString('sq-AL')}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
              
              <div class="service-details">
                <div class="service-header">Detajet e Shërbimit</div>
                <div class="service-content">
                  <div class="service-item">
                    <div>
                      <div class="service-name">${service.name}</div>
                      <div class="service-description">${service.description || 'Shërbim profesional teknologjik'}</div>
                    </div>
                    <div class="amount">${invoice.amount}€</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">
                Ky dokument është gjeneruar automatikisht nga sistemi i menaxhimit të klientëve<br>
                Faleminderit që zgjodhët shërbimet tona profesionale
              </div>
              <div class="footer-logo">NaN Studio - Professional Technology Services</div>
            </div>
          </div>
          
          <script>
            // Auto-focus for better print experience and button handlers
            window.addEventListener('load', function() {
              console.log('Fatura e ngarkuar. Klikoni "Printo si PDF" për të ruajtur si PDF.');
              
              // Add event listeners for buttons (CSP-compliant)
              document.getElementById('print-btn').addEventListener('click', function() {
                window.print();
              });
              
              document.getElementById('close-btn').addEventListener('click', function() {
                window.close();
              });
            });
          </script>
        </body>
        </html>
      `;
      
      res.send(printableHtml);
    } catch (error) {
      console.error('Download invoice error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error
      });
      res.status(500).json({ 
        error: 'Failed to generate invoice document',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  });

  // Invoice email sending endpoint  
  app.post("/api/invoices/:id/send-email", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get client and service details
      const client = await storage.getClient(invoice.clientId);
      const service = await storage.getService(invoice.serviceId);
      
      if (!client || !service) {
        return res.status(404).json({ error: 'Client or service not found' });
      }

      // Check if SendGrid API key is available
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ 
          error: 'Email service not configured. SENDGRID_API_KEY is missing.' 
        });
      }

      // Development mode fallback - simulate email sending without SendGrid
      if (isDevelopment) {
        console.log('📧 Development Mode: Simulating email send');
        console.log(`📧 To: ${client.email}`);
        console.log(`📧 Subject: Fatura #${invoice.id.slice(-8).toUpperCase()} - ${service.name}`);
        console.log(`📧 Invoice ID: ${invoice.id}`);
        console.log(`📧 Amount: ${invoice.amount}€`);
        
        // Simulate a small delay to make it feel realistic
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.json({ 
          success: true, 
          message: 'Email u dërgua me sukses! (Development Mode)',
          recipient: client.email,
          mode: 'development'
        });
        return;
      }

      try {
        // Dynamically import SendGrid only in production
        const sgMail = (await import('@sendgrid/mail')).default;
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const emailContent = `
          Përshëndetje ${client.name},

          Ju dërgojmë faturën tuaj për shërbimin: ${service.name}
          
          Detajet e faturës:
          - Numri i faturës: #${invoice.id.slice(-8).toUpperCase()}
          - Shuma: ${invoice.amount}€
          - Data e lëshimit: ${new Date(invoice.issueDate).toLocaleDateString('sq-AL')}
          - Skadenca: ${new Date(invoice.dueDate).toLocaleDateString('sq-AL')}
          - Statusi: ${invoice.status === 'paid' ? 'Paguar' : invoice.status === 'pending' ? 'Në pritje' : 'Vonesa'}
          
          ${invoice.status !== 'paid' ? 'Ju lutem kryeni pagesën brenda afatit të caktuar.' : 'Faleminderit për pagesën!'}
          
          Me respekt,
          Ekipi i Menaxhimit të Klientëve
        `;

        const msg = {
          to: client.email,
          from: 'noreply@replit.app', // Using replit.app domain which is more likely to work
          subject: `Fatura #${invoice.id.slice(-8).toUpperCase()} - ${service.name}`,
          text: emailContent,
          html: emailContent.replace(/\n/g, '<br>')
        };

        await sgMail.send(msg);
        
        res.json({ 
          success: true, 
          message: 'Email u dërgua me sukses!',
          recipient: client.email 
        });
        
      } catch (emailError) {
        console.error('SendGrid error details:', {
          message: emailError instanceof Error ? emailError.message : String(emailError),
          code: (emailError as any)?.code || 'no-code',
          response: (emailError as any)?.response?.body || 'no-response-body',
          stack: emailError instanceof Error ? emailError.stack : undefined
        });
        res.status(500).json({ 
          error: 'Failed to send email via SendGrid',
          details: process.env.NODE_ENV === 'development' && emailError instanceof Error ? emailError.message : 'Check server logs for details'
        });
      }
    } catch (error) {
      console.error('Send invoice email error:', error);
      res.status(500).json({ error: 'Failed to send invoice email' });
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

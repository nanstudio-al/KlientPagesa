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
import PDFDocument from "pdfkit";
import { randomUUID } from "crypto";
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
    // Configure validation to work with Express trust proxy setting
    validate: {
      trustProxy: false  // Disable validation since we handle proxy config in Express
    },
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
    // Configure validation to work with Express trust proxy setting
    validate: {
      trustProxy: false  // Disable validation since we handle proxy config in Express
    }
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

  // Invoice PDF download endpoint - Direct PDF generation
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

      // Base64 encoded NaN Studio logo
      const logoBase64 = "iVBORw0KGgoAAAANSUhEUgAAASwAAACpCAYAAACRdwCqAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAgAElEQVR4nO2de9AkVZnmn+eLjo4OooMgXJbtYLHKYHux0kFWe4RBxbuyyswIwmah4wVxAK+IjouGMmowLqIziuHoKuqqIypqleCNVXQYg2AREVqHcViqZB2kUoJg2bYXCYLoYDu+Z//IzKqsrLxnVn1V1e+v4+vKk+fk+55L5psnT558D+CzgQkbsXA0Puk3La6IvCbDq65jI/ZnOmbDRf5MxxrriCcAgM2EfYci61gPTZUpT85mwTTz0t8Eq6QjS84m1qg9tjUlCPMtcBMV0oSOpvO5mbLdlMys+I2EfUVlbCA975sR2Vly4jLyiMqNyi4rJ09HKHMrdETDZUjKX7S+0uotT0YWW9IeST2sssQrJSmzeRdEXj7i8WUvsCo64sQbKElvERl1KWJM8tLnnVR1z4t53XHz6rtsvoveJKLhIvVblrA95tXjWrf2KPxsmfabdEwdmpRlOuoft8zlMB2mwzAMY3Uwy2cYxspiBswwjC2HMGNkGIZhGIZhGIZxiGKPhIZhrAxmrAzDWBnMYBmGsTKYwTIMY2WoYrDW0YuBYRgrQJbBMsNkGMZSYY+EhmEYhmEYTZM1DyvJ/1PWfsMwjLlSxjtgWadgW+UlNG/fIvKdx6rq2Iq6W9W62godi2BL66pOTylvwL6Kv/gsY1PVI2Oesapi4OJ5ycpbUtqyeUjTkeWmuKqOPPlljH+WnHA7r1xl9OTpi+qsKjtLTtOePouUo25ZVqo94j6Zi57oafuzGrDoCZ+ULis+S0fZCyqtYYpUaNRFdLzs0Z5s3JV0Vh7jaeI6ounq6sjTHZWbly5NfjxNkrvhJoxJ9Ng898NVfKnH6zkpPu/cr6IrqRx1XDavXHs05YO8TkPUvQtVIa+yssg6SYvoa6LRV1VHnYUW5sW86gpodqw3T9ch0R7LNHi+DIarSB6a7vYvC4soxzzrLq+XnJeXJnQ3qWOenYW0Y5e+PZbJYB3qrIvhWxR5jzNNyS0at2xkGYZ5lGMh7bGohVTn3dBb0TtYlMxF9ASaZF46ohdaOGaXFFdXR9J2UrgJknQ0rWeehmTL2qPsMl9p6apSdgnrpOPLrjs4Dx15OufBquiouy5kE8fNo66qXhPzekNfVPZKt0dVgzUv7FHVMIzGMcNiGIZhGIZhGIZhGIZhGIZhGIZhGIZhGMacsIVUDcNYGcxYGYaxMpjBMgxjZbB1CQ3DWBmqrEtovTLDMLYE62EZhrEyWG/JDLBhrAxmsKwODGNl2BYLxz0HZsVlpS1KnswmdJTVmZe+ME5vBJDHA9oDYBdAQLof5G0A7h64rSpiizKPujOqY+3RAAx+05aISrqw479pJMUXMVBF8lBXR51wbhqnP9om8Q2kLhJwLDCpaIX/EXdB+CjJqwZu6+AylmNJdRTBdKypjjyDhVh8nsGKxkWPTZKXltF4foqmj+chS2aekSwSTkzj9L0OhG8IOp4g5JuooKInYT9ECLqV5NkDt3Ufpsmqi6rhpPZKLEeFPITps3TULUdR6ugsI3+eOqJ6rBwVlBbJUJVj4r910uelyStvPH2pcjk9b4+gn4g6HgRE+JYq2BY1uUUE+0icLOinTs/bXUJV2XazRxFjLTjUTuSyRrKwzE7P2yXgexSPCKyT/+gXbHO8L7BYU/E4WsB/7/RGO0uWo1Qe53xME3XZBMuSD8On0fY41AzWHNHHAOwaBznpTIXhyQ5O/QSJdwO4bL55zKSpE2srDEaTOpNuZk3e4IrobkLXspSjKVmbwHwM1iF3h3P63pMAvhzAZIRKkW0A0sxh02kEgLzA6Xu7ElLOmybbbJ43wax8LutFmDV00aSeOBux33C7yqB5Ggtvj6SML4PByRtLSgpXOaZOeLxP0jnB893kjwXCnInfLuHPkHxXbCJc9A5eV0f0r2kdcbnzqKs0XVVk...";

      // Generate PDF using PDFKit (pure JavaScript, no dependencies)
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        // Create chunks array to collect PDF data
        const chunks: Buffer[] = [];
        
        // Collect data chunks
        doc.on('data', chunk => chunks.push(chunk));
        
        // Handle PDF completion
        const pdfPromise = new Promise<Buffer>((resolve) => {
          doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            resolve(pdfBuffer);
          });
        });

        // Page dimensions
        const pageWidth = doc.page.width;
        const leftMargin = 50;
        const rightMargin = pageWidth - 50;
        const usableWidth = rightMargin - leftMargin;
        
        // Header with white background
        doc.rect(0, 0, pageWidth, 200).fill('#ffffff').stroke('#e2e8f0');
        
        // Add NaN Studio logo image
        const logoBase64 = "iVBORw0KGgoAAAANSUhEUgAAA+sAAAOMCAYAAAA18SKrAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAP+lSURBVHhe7N11mBz14cfx98z67rnk4i5H3EkCwSJIcAiSQIsUWlpKoTgtBYoVfrRIS4G2WPHirkESICQQJyGBOPGc+97uzvz+2JPdPcnFYBM+r+eZBzK2M7N7u/OZrxm2bduIiIiIiIiISNIwE2eIiIiIiIiIyI/LWPf9OpWsi4iIiIiIiCQR4+CDD1ZYFxEREREREUkiqgYvIiIiIiIikmQU1kVERERERESSjMK6iIiIiIiISJJRWBcRERERERFJMgrrIiIiIiIiIklGYV1EREREREQkySisi4iIiIiIiCQZhXURERERERGRJKOwLiIiIiIiIpJkFNZFREREREREkozCuoiIiIiIiEiSUVgXERERERERSTIK6yIiIiIiIiJJRmFdREREREREJMkorIuIiIiIiIgkGYV1ERERERERkSSjsC4iIiIiIiKSZIyDDz7YTpwpkizWr1+fOGuP6tq1a+Ksfcq4ceP4/PPPE2cnlb39Hu5pyf6Z2Bfe833dvniN98VjFhERkdapZF1EREREREQkySisi4gIAMcffzz/+9//ePPNN1udXnjhBY477rjEzfeaadOmcc455yTOFhEREdmvKayLiAgAv/zlL1m9ejVPP/10q9PKlSv51a9+lbj5XnHyySczffp0UlJSEhcltZNPPpnHHnuM66+/Hq/Xm7hYREREZIcU1kVEpMHixYt56qmnWp0WL16cuNlecfrpp3P++ecDkJqaymmnncbQoUMTV0s6V199NWeddRbLli1jzJgxHHrooYmriIiIiOyQwrqIyF5y++23c/vttyfO3qeceeaZnHnmmYmzfxBOp7Ph//v06cPPf/5zbr31Vm6++WaysrLi1k0mb7/9NjfddBMPPfQQJJzHvsAwDIYOHUpubm7ioh9Nbm4uQ4cOxTCMxEUiIiL7LYV12W+c9+xi1q1bzLPnJS7ZRVPv46237mNq4vyWTL2Pt2bN4q372ryF1LtrBuvWrWsyLa5/M897lsVxy2Le55hlDes3zJ/BXY1zZCedfPLJnHXWWZx11lmcfPLJiYv3ihEjRjBs2DAAnnrqKZ599lkAvvrqK8466yweffRRDjjgAB544AE6dOiQsHVyWLx4MYsWLWq4ZrNnz05cJWkZhsGwYcPIycnBNJPnFsE0TXJychg2bJgCu4iI/GQkzy+xyC67ixnr1nEpy1iZuGg3TB3fG1bO4vnEBc249slZzDoXVq5LXCJtcsUEunXr1jjdNJtSVvLeGY80rlM6m5sa1hlMdNF5PHtpf5bd1I1u3W5iWf9LG0L8XdP7s+ymCVzRuAdpg/oglJ2djc/na2in7vP5yM7OjltnTxsxYgR//vOf+dOf/tRQ3f2JJ57g6aefpqqqiuLiYl544QXOP/98qqurueKK5H13e/Xqxamnnsrbb79NUVFRw/xzzjmHJ554gscee4yTTjopbpsfW31Qz8rKYunSpWzdujVxlR/N1q1bWbp0KVlZWQrsIiLyk6GwLvuBK5jQrRuDz9iQuGA3XMsJw4qYdUlbojrcftZ4xh9zCZsTF8guuWv6WLY/HxO0++eSvn0DMdG9fgG5LOO9RwAeYcP2utl3zWDy9nvqAr3sDNu2ASgsLGzSVr2wsDBunT1p+PDh/PnPf2bz5s0UFhZy6623NgT2p556iscee6xh3dLSUu6++27y8/M55ZRTYvaSPH7zm99QUlLCo48+CkB6ejp/+9vfmDp1KkuWLGHr1q384he/YOLEiYmb/mgGDx5MdnY2hmEwcOBAJk2aFDcdeuihDBkyBLfbnbjpHuN2uxk6dCiHHnpok9cfOHAghmGQnZ3N4MGDEzcVERHZ7yisizTn2gF0W7eUfbu1cevy8vIa2lTvaGrXrl3i5nvPec8yOXc2TyUWmvae2lANfkZD3fZlbKc/k88DOI/OudvZ8MhdzJi8nXt+hKT+l7/8JW7q2bMnPXv2bDJf4g0ePJibb76ZjRs3ctVVV3HVVVexceNGbr311hZD2aJFi1izZg2TJk1KXPSjGzduHP369ePRRx+lsrISt9vNLbfcQvv27fn973/PnXfeydVXX83q1as59thjEzf/0WzYsAHbtrFtm/Xr17Nq1aq4qaCggOzsbMaMGbNXArvb7WbMmDFkZWVRUFDQ5PXXr1+PbdtEIhE2bNiQuKWIiMj+R2FdpImpi8HZzJi8nXt+BK99999//3tc9p155pkcdNBBvPfee/zqV7/irrvuIjs7O276yU9+wsSJE3nppZcYOHAgl19+Oe3ateOGG26A/rAPOI888siErf/BJk2axPPPP89jjz3G3Llz+fGPf8wVV1xBkyZP5x//8BddddVVjBgxgiuvvJJrr72Wtm3b8uijj9KuXTsuvfRS3nnnHc444wx69erF7NmzefXVV3nggQc466yzGDlyJGPHjuWFF17gzDPP5K9//SsPPfQQv//977njjjsaNHwwgwYN5uGHH2bDhg1cccUVXH755WzcuJEPDYrz589n7NixXHDhRQ2h7KOPPmLy5Ml0796dOXPmJO76wzJu3Dj69evHo48+SlVVFW63m1tuuYX27dvz+9//njvvvJOrr76a1atXc+yxxyZu+6PZsGEDtm1j2zbr169n1apVcVNBQQFZWVmMGTNmrwR2t9vNmDFjyMrKoqCgoMnrr1+/Htu2iUQiOzZP/r+wOYf2DMZMHCQ=";
        // Set text color to dark for header content
        doc.fill('#1e293b');
        
        // Add NaN Studio logo image (properly sized)
        try {
          const logoPath = './attached_assets/NaN-Logotype-05-300x169 (2)_1758911567490.png';
          console.log('Attempting to load logo from:', logoPath);
          
          // Properly sized logo - not too big
          doc.image(logoPath, leftMargin, 30, { width: 100, height: 56 });
          console.log('Logo loaded successfully');
        } catch (error) {
          console.log('Logo loading failed:', error instanceof Error ? error.message : String(error));
          doc.font('Helvetica-Bold')
             .fontSize(18)
             .text('NaN Studio', leftMargin, 40);
        }
        
        // Invoice number and dates
        const formattedNumber = String(invoice.invoiceNumber || 1).padStart(3, '0');
        doc.font('Helvetica')
           .fontSize(12)
           .text('Fatura:', leftMargin, 110)
           .font('Helvetica-Bold')
           .text(`#${formattedNumber}`, leftMargin + 50, 110);
        
        // Dates on the right
        const rightX = leftMargin + usableWidth / 2;
        doc.font('Helvetica')
           .fontSize(12)
           .text('Data e lëshimit:', rightX, 130)
           .font('Helvetica-Bold')
           .text(new Date(invoice.issueDate).toLocaleDateString('sq-AL'), rightX + 100, 130);
           
        doc.font('Helvetica')
           .fontSize(12)
           .text('Skadenca:', rightX, 150)
           .font('Helvetica-Bold')
           .text(new Date(invoice.dueDate).toLocaleDateString('sq-AL'), rightX + 100, 150);
        
        // Reset to black for body content
        doc.fill('#000000');
        
        let yPos = 240;
        
        // Client Info Section
        doc.rect(leftMargin, yPos, usableWidth, 150).fill('#f8fafc').stroke('#e2e8f0');
        yPos += 20;
        
        // Client info
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fill('#0f172a')
           .text('Faturuar për:', leftMargin + 20, yPos);
        yPos += 30;
        
        // Client info with proper positioning to avoid overlaps
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fill('#475569')
           .text('Klienti:', leftMargin + 20, yPos);
        doc.font('Helvetica')
           .fill('#1e293b')
           .text(client.name, leftMargin + 120, yPos);
        yPos += 20;
        
        doc.font('Helvetica-Bold')
           .fill('#475569')
           .text('Email:', leftMargin + 20, yPos);
        doc.font('Helvetica')
           .fill('#1e293b')
           .text(client.email, leftMargin + 120, yPos);
        yPos += 20;
        
        if (client.phone) {
          doc.font('Helvetica-Bold')
             .fill('#475569')
             .text('Telefoni:', leftMargin + 20, yPos);
          doc.font('Helvetica')
             .fill('#1e293b')
             .text(client.phone, leftMargin + 120, yPos);
          yPos += 20;
        }
        
        if (client.address) {
          doc.font('Helvetica-Bold')
             .fill('#475569')
             .text('Adresa:', leftMargin + 20, yPos);
          doc.font('Helvetica')
             .fill('#1e293b')
             .text(client.address, leftMargin + 120, yPos, { width: usableWidth - 140 });
          yPos += 20;
        }
        
        // Payment Status (right side)
        const statusX = leftMargin + usableWidth / 2 + 20;
        let statusY = 260;
        
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fill('#0f172a')
           .text('Statusi i Pagesës:', statusX, statusY);
        statusY += 30;
        
        const statusText = invoice.status === 'paid' ? 'Paguar' : invoice.status === 'pending' ? 'Në pritje' : 'Vonesa';
        const statusColor = invoice.status === 'paid' ? '#166534' : invoice.status === 'pending' ? '#92400e' : '#991b1b';
        const statusBg = invoice.status === 'paid' ? '#dcfce7' : invoice.status === 'pending' ? '#fef3c7' : '#fee2e2';
        
        // Status badge
        doc.rect(statusX, statusY, 100, 25).fill(statusBg);
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fill(statusColor)
           .text(statusText.toUpperCase(), statusX + 10, statusY + 8);
        
        if (invoice.paidDate) {
          statusY += 40;
          doc.font('Helvetica-Bold')
             .fontSize(12)
             .fill('#475569')
             .text('Data e pagesës:', statusX, statusY);
          doc.font('Helvetica')
             .fill('#1e293b')
             .text(new Date(invoice.paidDate).toLocaleDateString('sq-AL'), statusX + 100, statusY);
        }
        
        yPos = 420;
        
        // Service Details Section
        doc.rect(leftMargin, yPos, usableWidth, 30).fill('#ffffff').stroke('#e2e8f0');
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fill('#1e293b')
           .text('Detajet e Shërbimit', leftMargin + 20, yPos + 8);
        
        yPos += 30;
        doc.rect(leftMargin, yPos, usableWidth, 80).fill('#ffffff').stroke('#e2e8f0');
        yPos += 20;
        
        // Service item - smaller text
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fill('#1e293b')
           .text(service.name, leftMargin + 20, yPos, { width: usableWidth - 120 });
        yPos += 20;
        
        doc.font('Helvetica')
           .fontSize(10)
           .fill('#64748b')
           .text(service.description || 'Shërbim profesional teknologjik', leftMargin + 20, yPos, { width: usableWidth - 120 });
        
        // Amount (right side) - separate number and Euro symbol for proper alignment
        const amountText = invoice.amount.toString();
        const amountX = rightMargin - 100;
        const amountY = yPos - 20;
        
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fill('#0ea5e9')
           .text(amountText, amountX, amountY, { width: 60, align: 'right' });
           
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fill('#0ea5e9')
           .text('€', amountX + 65, amountY);
        
        yPos += 80;
        
        // Footer - positioned at bottom of page
        const pageHeight = doc.page.height;
        const footerY = pageHeight - 120; // 120px from bottom
        
        doc.rect(0, footerY, pageWidth, 100).fill('#f8fafc').stroke('#e2e8f0');
        
        doc.font('Helvetica')
           .fontSize(12)
           .fill('#64748b')
           .text('Ky dokument është gjeneruar automatikisht nga sistemi i menaxhimit të klientëve', 
                 leftMargin, footerY + 20, { width: usableWidth, align: 'center' });
        
        doc.text('Faleminderit që zgjodhët shërbimet tona profesionale', 
                 leftMargin, footerY + 40, { width: usableWidth, align: 'center' });
        
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .fill('#0ea5e9')
           .text('NaN Studio - Professional Technology Services', 
                 leftMargin, footerY + 70, { width: usableWidth, align: 'center' });
        
        // Finalize the PDF
        doc.end();
        
        // Wait for PDF generation to complete
        const pdfBuffer = await pdfPromise;

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="fatura-${invoice.id.slice(-8)}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // Send PDF buffer
        res.send(pdfBuffer);
        
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError instanceof Error ? pdfError.message : String(pdfError));
        res.status(500).json({ 
          error: 'Failed to generate PDF',
          details: process.env.NODE_ENV === 'development' && pdfError instanceof Error ? pdfError.message : undefined
        });
      }
      
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ 
        error: 'Failed to generate PDF',
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

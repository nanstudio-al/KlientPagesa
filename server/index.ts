import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import bcrypt from "bcryptjs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Admin user seeding function
async function seedAdminUser() {
  try {
    // Check if any admin users exist
    const users = await storage.listUsers();
    const adminUsers = users.filter(user => user.role === 'admin' && user.isActive);
    
    if (adminUsers.length === 0) {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminPassword) {
        if (process.env.NODE_ENV === 'production') {
          log('ERROR: ADMIN_PASSWORD environment variable is required in production');
          log('Please add ADMIN_PASSWORD to your deployment secrets and restart the application');
          log('The application cannot create an admin user without this password');
          throw new Error('Missing ADMIN_PASSWORD environment variable in production');
        } else {
          // Use default password in development  
          const generatedPassword = 'admin123';
          log(`No admin user found. Creating admin user with username: ${adminUsername} and password: ${generatedPassword}`);
          
          const passwordHash = await bcrypt.hash(generatedPassword, 12);
          await storage.createUser({
            username: adminUsername,
            passwordHash,
            email: 'admin@localhost',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            isActive: 1
          });
          
          log(`Admin user created successfully! Use username: ${adminUsername}, password: ${generatedPassword}`);
        }
      } else {
        log(`Creating admin user with username: ${adminUsername}`);
        
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await storage.createUser({
          username: adminUsername,
          passwordHash,
          email: process.env.ADMIN_EMAIL || 'admin@localhost',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: 1
        });
        
        log('Admin user created successfully!');
      }
    } else {
      log(`Found ${adminUsers.length} active admin user(s)`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('Error seeding admin user: ' + errorMessage);
    
    if (process.env.NODE_ENV === 'production') {
      log('CRITICAL ERROR: Unable to seed admin user in production');
      log('This prevents the application from having any admin access');
      log('Please check your environment variables and database connectivity');
      
      // Re-throw the error to let the application handle it appropriately
      throw error;
    } else {
      log('Admin user seeding failed in development - continuing with startup');
    }
  }
}

(async () => {
  const server = await registerRoutes(app);
  
  // Seed admin user on startup
  await seedAdminUser();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

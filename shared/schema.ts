import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, pgEnum, index, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Client/Customer table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"), // NIPT for companies
  isCompany: integer("is_company").default(0).notNull(), // 0 = individual, 1 = company
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Services table
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  billingPeriod: text("billing_period").notNull(), // "monthly", "quarterly", "yearly"
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Client Services (many-to-many)
export const clientServices = pgTable("client_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  startDate: timestamp("start_date").default(sql`now()`).notNull(),
  isActive: integer("is_active").default(1).notNull(),
});

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", ["paid", "pending", "overdue"]);

// User role enum
export const roleEnum = pgEnum("role", ["admin", "user"]);

// Invoices table - multiple services support
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: integer("invoice_number").unique(),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  issueDate: timestamp("issue_date").default(sql`now()`).notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  paidDate: timestamp("paid_date"),
});

// Invoice Services junction table (many-to-many)
export const invoiceServices = pgTable("invoice_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(), // quantity * unitPrice
});

// Zod schemas
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
});

export const insertClientServiceSchema = createInsertSchema(clientServices).omit({
  id: true,
});

export const insertInvoiceServiceSchema = createInsertSchema(invoiceServices).omit({
  id: true,
  invoiceId: true,
  lineTotal: true, // calculated field
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  invoiceNumber: true,
  issueDate: true,
  totalAmount: true, // calculated from services
}).extend({
  dueDate: z.coerce.date(),
  services: z.array(z.object({
    serviceId: z.string(),
    quantity: z.number().min(1).default(1),
    unitPrice: z.string().optional(), // Will use service price if not provided
  })).min(1, "At least one service is required"),
});

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Extended for custom authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: roleEnum("role").default("user").notNull(),
  isActive: integer("is_active").default(1).notNull(), // 1 = active, 0 = inactive
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// User schemas for authentication
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUserSchema = insertUserSchema.omit({
  passwordHash: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "user"]).optional(),
  isActive: z.number().min(0).max(1).optional(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UserRole = "admin" | "user";

// Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type ClientService = typeof clientServices.$inferSelect;
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceService = typeof invoiceServices.$inferSelect;
export type InsertInvoiceService = z.infer<typeof insertInvoiceServiceSchema>;
export type PaymentStatus = "paid" | "pending" | "overdue";

// Extended types for invoice with services
export type InvoiceWithServices = Invoice & {
  services: (InvoiceService & { service: Service })[];
};

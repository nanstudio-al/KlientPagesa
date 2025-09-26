import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, pgEnum, index, jsonb } from "drizzle-orm/pg-core";
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

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  issueDate: timestamp("issue_date").default(sql`now()`).notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  paidDate: timestamp("paid_date"),
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

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  issueDate: true,
}).extend({
  dueDate: z.coerce.date(),
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

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type ClientService = typeof clientServices.$inferSelect;
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type PaymentStatus = "paid" | "pending" | "overdue";

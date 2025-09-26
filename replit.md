# Customer & Payment Management System

## Overview

This is a comprehensive customer and payment management system designed for Albanian businesses providing technical services like web hosting, email services, and technical support. The application is built as a full-stack TypeScript solution using React for the frontend and Express.js for the backend, with PostgreSQL as the database. It features multi-language support (Albanian interface), professional financial management tools, and a clean design system optimized for business productivity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18+ with TypeScript and Vite for development/build tooling
- **Routing**: Wouter for client-side routing (lightweight React Router alternative)
- **State Management**: TanStack Query (React Query) for server state management and API caching
- **UI Framework**: Radix UI primitives with shadcn/ui components for consistent design
- **Styling**: Tailwind CSS with custom CSS variables for theming support (light/dark mode)
- **Form Management**: React Hook Form with Zod validation for type-safe form handling
- **Design System**: Professional utility-focused design with Inter font, semantic color palette

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with conventional HTTP methods and status codes
- **Session Management**: Express sessions with PostgreSQL session storage (connect-pg-simple)
- **Validation**: Zod schemas for request/response validation shared between client and server
- **Error Handling**: Centralized error middleware with structured error responses

### Data Storage
- **Database**: PostgreSQL with connection pooling via Neon serverless
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **Schema Design**: Relational design with proper foreign key relationships
  - Clients table (supports both individuals and companies with tax ID)
  - Services table with flexible billing periods (monthly/quarterly/yearly)
  - Client-Services many-to-many relationship table
  - Invoices table with payment status tracking and due date management
- **Migrations**: Drizzle Kit for database schema versioning and deployment

### Authentication & Authorization
- **Session-based Authentication**: Uses Express sessions stored in PostgreSQL
- **No JWT**: Relies on traditional server-side sessions for simplicity and security
- **CSRF Protection**: Implicit through same-origin session cookies

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL provider for production database hosting
- **Connection Pooling**: @neondatabase/serverless with WebSocket support for optimal performance

### Email Services
- **SendGrid**: Email delivery service for automated invoice notifications and client communications via @sendgrid/mail

### UI & Component Libraries
- **Radix UI**: Comprehensive set of accessible, unstyled UI primitives (@radix-ui/react-*)
- **Lucide React**: Icon library providing consistent iconography throughout the application
- **date-fns**: Date manipulation and formatting library for invoice date handling

### Development & Build Tools
- **Vite**: Modern build tool with HMR for fast development experience
- **ESBuild**: Fast TypeScript compilation for production builds
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer
- **TSX**: TypeScript execution for development server

### Validation & Type Safety
- **Zod**: Runtime type validation shared between frontend and backend
- **Drizzle-Zod**: Integration between Drizzle ORM and Zod for database schema validation
- **TypeScript**: End-to-end type safety across the entire application stack
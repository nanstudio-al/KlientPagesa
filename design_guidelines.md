# Customer & Payment Management System - Design Guidelines

## Design Approach
**Selected Approach:** Design System (Utility-Focused)
**System Choice:** Clean, professional design system optimized for data-heavy enterprise applications
**Justification:** This is a business productivity tool requiring clarity, efficiency, and professional appearance for financial data management.

## Core Design Elements

### A. Color Palette
**Primary Colors:**
- Light Mode: 220 15% 25% (Deep navy-blue for headers, navigation)
- Dark Mode: 220 20% 15% (Darker navy-blue)

**Background Colors:**
- Light Mode: 0 0% 98% (Off-white backgrounds)  
- Dark Mode: 220 15% 8% (Very dark blue-gray)

**Accent Colors:**
- Success (Paid): 142 70% 45% (Professional green)
- Warning (Due Soon): 38 85% 55% (Amber for approaching due dates)
- Danger (Overdue): 0 65% 55% (Clear red for overdue payments)

**Neutral Grays:**
- Light Mode: 220 10% 50% (Text secondary)
- Dark Mode: 220 15% 70% (Text secondary in dark mode)

### B. Typography
**Font Family:** Inter (via Google Fonts CDN)
**Hierarchy:**
- Headings: font-semibold, sizes from text-3xl to text-lg
- Body text: font-normal, text-sm to text-base
- Data/numbers: font-mono for currency and dates
- Labels: font-medium, text-xs to text-sm

### C. Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Tight spacing: p-2, m-2 (8px)
- Standard spacing: p-4, m-4 (16px) 
- Section spacing: p-6, m-6 (24px)
- Large spacing: p-8, m-8 (32px)

### D. Component Library

**Navigation:**
- Clean sidebar with service icons
- Breadcrumb navigation for deep pages
- Tab navigation for client detail sections

**Data Display:**
- Professional tables with alternating row colors
- Cards for client summaries and service overviews
- Status badges for payment states (paid/pending/overdue)
- Progress indicators for payment timelines

**Forms:**
- Consistent input styling with proper labels
- Form sections with subtle borders
- Inline validation states
- Professional button hierarchy

**Dashboard Elements:**
- KPI cards with clean typography
- Simple charts for revenue tracking (using Chart.js)
- Alert boxes for payment reminders
- Clean modals for invoice details

### E. Visual Hierarchy
- Use consistent spacing between sections
- Employ subtle shadows and borders for card separation
- Maintain clear visual distinction between different data types
- Professional color coding for financial status indicators

## Key Design Principles
1. **Data Clarity:** Financial information must be immediately scannable
2. **Professional Appearance:** Suitable for business-to-business use
3. **Consistent Status Communication:** Clear visual language for payment states
4. **Efficient Workflows:** Minimal clicks between related information
5. **Responsive Design:** Works equally well on desktop and mobile devices

## Images
No decorative images required. This is a data-focused application where:
- Use professional icons (Heroicons) for services and navigation
- Client logos/avatars as small circular placeholders
- Simple charts and graphs for financial data visualization
- No hero image needed - focus on functional dashboard design
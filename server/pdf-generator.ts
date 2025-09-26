import PDFDocument from 'pdfkit';
import type { InvoiceWithServices, Client } from '@shared/schema';

export async function generateModernInvoicePDF(invoice: InvoiceWithServices, client: Client): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  
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

  // Modern color palette
  const colors = {
    primary: '#0ea5e9',      // Sky blue
    primaryDark: '#0284c7',   // Darker blue
    accent: '#06b6d4',        // Cyan
    dark: '#0f172a',          // Very dark blue
    medium: '#334155',        // Medium slate
    light: '#64748b',         // Light slate
    background: '#f8fafc',    // Very light blue
    success: '#10b981',       // Green
    warning: '#f59e0b',       // Amber
    danger: '#ef4444'         // Red
  };

  // Page dimensions
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const leftMargin = 40;
  const rightMargin = pageWidth - 40;
  const usableWidth = rightMargin - leftMargin;

  // MODERN HEADER without background
  const headerHeight = 140;

  // Company Logo and Brand
  try {
    const logoPath = './attached_assets/NaN-Logotype-05-300x169 (2)_1758911567490.png';
    doc.image(logoPath, leftMargin, 25, { width: 110, height: 62 });
  } catch (error) {
    // Modern fallback text logo
    doc.font('Helvetica-Bold')
       .fontSize(22)
       .fillColor(colors.dark)
       .text('NaN Studio', leftMargin, 35);
       
    doc.font('Helvetica')
       .fontSize(11)
       .fillColor(colors.medium)
       .text('Professional Technology Services', leftMargin, 62);
  }

  // Modern Invoice Title - Right side of header
  const invoiceNumber = String(invoice.invoiceNumber || 1).padStart(3, '0');
  doc.font('Helvetica-Bold')
     .fontSize(28)
     .fillColor(colors.dark)
     .text('FATURË', rightMargin - 130, 25, { align: 'right', width: 130 });
     
  doc.font('Helvetica-Bold')
     .fontSize(16)
     .fillColor(colors.primary)
     .text(`#${invoiceNumber}`, rightMargin - 130, 55, { align: 'right', width: 130 });

  // Date information in header
  doc.font('Helvetica')
     .fontSize(10)
     .fillColor(colors.light)
     .text('Lëshuar:', rightMargin - 130, 80, { align: 'right', width: 60 })
     .font('Helvetica-Bold')
     .fillColor(colors.medium)
     .text(new Date(invoice.issueDate).toLocaleDateString('sq-AL'), rightMargin - 65, 80, { align: 'right', width: 65 })
     .font('Helvetica')
     .fillColor(colors.light)
     .text('Skadon:', rightMargin - 130, 95, { align: 'right', width: 60 })
     .font('Helvetica-Bold')
     .fillColor(colors.medium)
     .text(new Date(invoice.dueDate).toLocaleDateString('sq-AL'), rightMargin - 65, 95, { align: 'right', width: 65 });

  let currentY = headerHeight + 30;

  // CLIENT INFORMATION - Modern card design
  const clientCardHeight = 100;
  
  // Card shadow effect
  doc.rect(leftMargin + 3, currentY + 3, usableWidth, clientCardHeight)
     .fillOpacity(0.1)
     .fill(colors.dark)
     .fillOpacity(1);
     
  // Main client card
  doc.rect(leftMargin, currentY, usableWidth, clientCardHeight)
     .fillAndStroke('#ffffff', '#e2e8f0')
     .lineWidth(1);

  // Card header with accent
  doc.rect(leftMargin, currentY, usableWidth, 30)
     .fill(colors.background);

  doc.font('Helvetica-Bold')
     .fontSize(13)
     .fillColor(colors.dark)
     .text('FATURUAR PËR', leftMargin + 15, currentY + 8);

  // Client details with modern spacing
  let clientY = currentY + 45;
  
  doc.font('Helvetica-Bold')
     .fontSize(15)
     .fillColor(colors.dark)
     .text(client.name, leftMargin + 15, clientY);
  
  clientY += 20;
  
  // Two-column layout for client info
  const col1X = leftMargin + 15;
  const col2X = leftMargin + usableWidth / 2;
  
  doc.font('Helvetica')
     .fontSize(10)
     .fillColor(colors.light)
     .text('Email:', col1X, clientY)
     .font('Helvetica-Bold')
     .fillColor(colors.medium)
     .text(client.email, col1X + 35, clientY);

  if (client.phone) {
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.light)
       .text('Tel:', col2X, clientY)
       .font('Helvetica-Bold')
       .fillColor(colors.medium)
       .text(client.phone, col2X + 25, clientY);
  }

  currentY += clientCardHeight + 30;

  // PAYMENT STATUS - Modern status card
  const statusCardHeight = 60;
  
  // Determine status styling
  const statusText = invoice.status === 'paid' ? 'PAGUAR' : 
                     invoice.status === 'pending' ? 'NË PRITJE' : 'VONESA';
  const statusColor = invoice.status === 'paid' ? colors.success : 
                      invoice.status === 'pending' ? colors.warning : colors.danger;
  const statusBg = invoice.status === 'paid' ? '#ecfdf5' : 
                   invoice.status === 'pending' ? '#fffbeb' : '#fef2f2';

  // Status card
  doc.rect(leftMargin, currentY, usableWidth, statusCardHeight)
     .fillAndStroke('#ffffff', '#e2e8f0')
     .lineWidth(1);

  // Status badge - modern pill shape
  const badgeWidth = 120;
  const badgeX = rightMargin - badgeWidth - 15;
  
  doc.roundedRect(badgeX, currentY + 15, badgeWidth, 30, 15)
     .fill(statusBg);

  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor(statusColor)
     .text(statusText, badgeX, currentY + 25, { width: badgeWidth, align: 'center' });

  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor(colors.dark)
     .text('Statusi i Pagesës', leftMargin + 15, currentY + 25);

  currentY += statusCardHeight + 40;

  // SERVICES TABLE - Modern table design
  doc.font('Helvetica-Bold')
     .fontSize(16)
     .fillColor(colors.dark)
     .text('DETAJET E SHËRBIMEVE', leftMargin, currentY);

  currentY += 30;

  // Table header with modern styling
  const tableHeaderHeight = 35;
  
  doc.rect(leftMargin, currentY, usableWidth, tableHeaderHeight)
     .fill(colors.primary);

  doc.font('Helvetica-Bold')
     .fontSize(11)
     .fillColor('#ffffff')
     .text('SHËRBIMI', leftMargin + 15, currentY + 12)
     .text('SASIA', leftMargin + 280, currentY + 12)
     .text('ÇMIMI', leftMargin + 350, currentY + 12)
     .text('TOTALI', leftMargin + 450, currentY + 12);

  currentY += tableHeaderHeight;

  // Service rows with alternating colors
  let rowIndex = 0;
  for (const invoiceService of invoice.services) {
    const rowHeight = 45;
    const rowColor = rowIndex % 2 === 0 ? '#ffffff' : colors.background;
    
    doc.rect(leftMargin, currentY, usableWidth, rowHeight)
       .fillAndStroke(rowColor, '#e2e8f0')
       .lineWidth(0.5);
    
    // Service name and description
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor(colors.dark)
       .text(invoiceService.service.name, leftMargin + 15, currentY + 8, { width: 250 });
    
    if (invoiceService.service.description) {
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor(colors.light)
         .text(invoiceService.service.description, leftMargin + 15, currentY + 22, { width: 250 });
    }
    
    // Quantity - centered
    doc.font('Helvetica')
       .fontSize(11)
       .fillColor(colors.medium)
       .text(invoiceService.quantity.toString(), leftMargin + 290, currentY + 16);
    
    // Unit price
    doc.font('Helvetica')
       .fontSize(11)
       .fillColor(colors.medium)
       .text(`€${invoiceService.unitPrice}`, leftMargin + 350, currentY + 16);
    
    // Line total - highlighted
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor(colors.primary)
       .text(`€${invoiceService.lineTotal}`, leftMargin + 450, currentY + 16);
    
    currentY += rowHeight;
    rowIndex++;
  }

  // TOTAL SECTION - Same style as service rows
  currentY += 15;
  const totalSectionHeight = 45;
  
  doc.rect(leftMargin, currentY, usableWidth, totalSectionHeight)
     .fillAndStroke(colors.background, '#e2e8f0')
     .lineWidth(0.5);

  doc.font('Helvetica-Bold')
     .fontSize(11)
     .fillColor(colors.dark)
     .text('TOTALI PËRFUNDIMTAR:', leftMargin + 15, currentY + 16);

  doc.font('Helvetica-Bold')
     .fontSize(11)
     .fillColor(colors.primary)
     .text(`€${invoice.totalAmount}`, leftMargin + 450, currentY + 16);

  // SIMPLE FOOTER
  const footerY = pageHeight - 30;
  
  doc.font('Helvetica')
     .fontSize(8)
     .fillColor(colors.light)
     .text('NaN Studio - Professional Technology Services', 
           leftMargin, footerY, { width: usableWidth, align: 'center' });

  // Finalize PDF
  doc.end();
  
  return await pdfPromise;
}
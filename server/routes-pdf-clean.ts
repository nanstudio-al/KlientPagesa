// Clean PDF download endpoint to replace the broken one in routes.ts

export const cleanPDFDownloadEndpoint = `
  // Invoice PDF download endpoint - Modern PDF generation
  app.get("/api/invoices/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(id);
      
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get client details (services are already included in InvoiceWithServices)
      const client = await storage.getClient(invoice.clientId);
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      if (invoice.services.length === 0) {
        return res.status(400).json({ error: 'Invoice has no services' });
      }

      // Generate PDF using modern PDF generator
      const { generateModernInvoicePDF } = await import('./pdf-generator');
      const pdfBuffer = await generateModernInvoicePDF(invoice, client);

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', \`attachment; filename="fatura-\${invoice.id.slice(-8)}.pdf"\`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      // Send PDF buffer
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error('PDF download error:', error);
      res.status(500).json({ 
        error: 'Failed to generate PDF',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  });
`;
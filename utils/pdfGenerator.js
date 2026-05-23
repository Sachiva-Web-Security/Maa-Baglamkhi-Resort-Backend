const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const generateInvoicePdf = async (invoice, options = {}) => {
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'invoices');
  ensureDir(uploadsDir);

  const fileName = `${String(invoice.invoiceNo || `inv-${invoice.id || Date.now()}`)}.pdf`.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  const filePath = path.join(uploadsDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice No: ${invoice.invoiceNo || ''}`);
    doc.text(`Date: ${invoice.date || ''}`);
    doc.text(`Customer: ${invoice.customerName || ''}`);
    doc.text(`Phone: ${invoice.phone || ''}`);
    doc.text(`Room(s): ${invoice.roomNumber || ''}`);
    doc.moveDown();

    doc.text('Items:', { underline: true });
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((it) => {
      doc.text(`- ${it.name} x ${it.quantity || 1} @ ${Number(it.price || 0).toFixed(2)} = ${Number(it.total || 0).toFixed(2)}`);
    });

    doc.moveDown();
    doc.text(`Subtotal: ${Number(invoice.subtotal || 0).toFixed(2)}`);
    doc.text(`Tax: ${Number(invoice.tax || 0).toFixed(2)}`);
    doc.text(`Discount: ${Number(invoice.discount || 0).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text(`Total: ${Number(invoice.totalAmount || 0).toFixed(2)}`, { bold: true });

    doc.end();

    stream.on('finish', () => resolve({ filePath, fileName }));
    stream.on('error', (err) => reject(err));
  });
};

module.exports = { generateInvoicePdf };

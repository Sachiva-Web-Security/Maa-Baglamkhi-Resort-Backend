const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const generateRestaurantBillPdf = async (bill, options = {}) => {
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'restaurant-bills');
  ensureDir(uploadsDir);

  const fileName = `${String(options.fileName || bill.billNo || bill.invoiceNo || bill.id || `restaurant-bill-${Date.now()}`)}.pdf`.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  const filePath = path.join(uploadsDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('Restaurant Bill', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Bill No: ${bill.billNo || bill.invoiceNo || bill.id || ''}`);
    doc.text(`Table: ${bill.tableNumber || bill.table || ''}`);
    doc.text(`Customer: ${bill.customerName || ''}`);
    doc.text(`Phone: ${bill.phone || ''}`);
    doc.text(`Date: ${bill.createdAt || bill.created_at || new Date().toISOString()}`);
    doc.moveDown();

    doc.text('Items:', { underline: true });
    const items = Array.isArray(bill.items) ? bill.items : [];
    items.forEach((item) => {
      const quantity = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const lineTotal = Number(item.amount ?? item.total ?? price * quantity);
      doc.text(`- ${item.name} x ${quantity} @ ${price.toFixed(2)} = ${lineTotal.toFixed(2)}`);
    });

    doc.moveDown();
    doc.text(`Subtotal: ${Number(bill.subtotal || 0).toFixed(2)}`);
    doc.text(`GST: ${Number(bill.gst || 0).toFixed(2)}`);
    doc.text(`Discount: ${Number(bill.discountAmount || bill.discount || 0).toFixed(2)}`);
    doc.fontSize(14).text(`Total: ${Number(bill.total || 0).toFixed(2)}`, { bold: true });

    doc.end();

    stream.on('finish', () => resolve({ filePath, fileName }));
    stream.on('error', (err) => reject(err));
  });
};

module.exports = { generateRestaurantBillPdf };
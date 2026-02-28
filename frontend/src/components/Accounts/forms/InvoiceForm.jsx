import { useState } from 'react';
import './InvoiceForm.css';

const todayISO = () => new Date().toISOString().slice(0, 10);

const InvoiceForm = ({ onSubmit, onCancel, initialData = {} }) => {
  const [form, setForm] = useState({
    invoiceNo: initialData.invoiceNo || `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    date: initialData.date || todayISO(),
    customerName: initialData.customerName || '',
    description: initialData.description || '',
    amount: initialData.amount ?? '',
    paymentMode: initialData.paymentMode || 'UPI',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amountNumber = Number(form.amount);
    if (!form.customerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    onSubmit({
      invoiceNo: form.invoiceNo.trim(),
      date: form.date,
      customerName: form.customerName.trim(),
      description: form.description.trim() || `Invoice ${form.invoiceNo}`,
      amount: amountNumber,
      paymentMode: form.paymentMode,
    });
  };

  return (
    <form className="accounts-invoice-form" onSubmit={handleSubmit}>
      <div className="accounts-invoice-form__row">
        <div className="accounts-invoice-form__field">
          <label className="accounts-invoice-form__label" htmlFor="invoiceNo">
            Invoice No
          </label>
          <input
            id="invoiceNo"
            name="invoiceNo"
            className="accounts-invoice-form__input"
            value={form.invoiceNo}
            onChange={handleChange}
            required
          />
        </div>
        <div className="accounts-invoice-form__field">
          <label className="accounts-invoice-form__label" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            className="accounts-invoice-form__input"
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="accounts-invoice-form__field">
        <label className="accounts-invoice-form__label" htmlFor="customerName">
          Customer Name
        </label>
        <input
          id="customerName"
          name="customerName"
          className="accounts-invoice-form__input"
          value={form.customerName}
          onChange={handleChange}
          placeholder="e.g. Rahul Sharma"
          required
        />
      </div>

      <div className="accounts-invoice-form__field">
        <label className="accounts-invoice-form__label" htmlFor="description">
          Description
        </label>
        <input
          id="description"
          name="description"
          className="accounts-invoice-form__input"
          value={form.description}
          onChange={handleChange}
          placeholder="e.g. Room booking invoice"
        />
      </div>

      <div className="accounts-invoice-form__row">
        <div className="accounts-invoice-form__field">
          <label className="accounts-invoice-form__label" htmlFor="amount">
            Amount (₹)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            className="accounts-invoice-form__input"
            value={form.amount}
            onChange={handleChange}
            min="1"
            required
          />
        </div>
        <div className="accounts-invoice-form__field">
          <label className="accounts-invoice-form__label" htmlFor="paymentMode">
            Payment Mode
          </label>
          <select
            id="paymentMode"
            name="paymentMode"
            className="accounts-invoice-form__input"
            value={form.paymentMode}
            onChange={handleChange}
          >
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>
      </div>

      <div className="accounts-invoice-form__actions">
        <button type="button" className="accounts-btn accounts-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="accounts-btn accounts-btn--primary">
          Generate
        </button>
      </div>
    </form>
  );
};

export default InvoiceForm;


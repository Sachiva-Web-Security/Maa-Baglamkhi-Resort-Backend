import { useState } from 'react';
import './TransactionForm.css';

const todayISO = () => new Date().toISOString().slice(0, 10);

const TransactionForm = ({ type, onSubmit, onCancel, initialData = {} }) => {
  const [form, setForm] = useState({
    date: initialData.date || todayISO(),
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
    if (!form.description.trim()) {
      alert('Please enter description');
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    onSubmit({
      type,
      date: form.date,
      description: form.description.trim(),
      amount: amountNumber,
      paymentMode: form.paymentMode,
    });
  };

  return (
    <form className="accounts-form" onSubmit={handleSubmit}>
      <div className="accounts-form__row">
        <div className="accounts-form__field">
          <label className="accounts-form__label">Type</label>
          <input className="accounts-form__input" value={type} disabled />
        </div>
        <div className="accounts-form__field">
          <label className="accounts-form__label" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            className="accounts-form__input"
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="accounts-form__field">
        <label className="accounts-form__label" htmlFor="description">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          className="accounts-form__input"
          value={form.description}
          onChange={handleChange}
          placeholder="e.g. Room Booking - 102"
          required
        />
      </div>

      <div className="accounts-form__row">
        <div className="accounts-form__field">
          <label className="accounts-form__label" htmlFor="amount">
            Amount (₹)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            className="accounts-form__input"
            value={form.amount}
            onChange={handleChange}
            placeholder="5000"
            min="1"
            required
          />
        </div>
        <div className="accounts-form__field">
          <label className="accounts-form__label" htmlFor="paymentMode">
            Payment Mode
          </label>
          <select
            id="paymentMode"
            name="paymentMode"
            className="accounts-form__input"
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

      <div className="accounts-form__actions">
        <button type="button" className="accounts-btn accounts-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="accounts-btn accounts-btn--primary">
          Save
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;


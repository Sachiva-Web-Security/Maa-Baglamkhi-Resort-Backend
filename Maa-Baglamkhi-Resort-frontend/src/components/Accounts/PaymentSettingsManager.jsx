import React from "react";
import { useEffect, useMemo, useState } from "react";

const emptyForm = {
  paymentMode: "UPI",
  department: "Hotel",
  providerName: "",
  upiId: "",
  accountHolderName: "",
  bankName: "",
  qrImageUrl: "",
  qrImageFile: null,
  isActive: true,
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-[#E4E1D8] bg-white px-3 py-2 text-[15px] text-[#1C231F] outline-none placeholder:text-[#6B6F66] focus:ring-2 focus:ring-[#CFE7E2]";

const PaymentSettingsManager = ({ rows, onSubmit, onUpdate, onDelete }) => {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const activeRows = useMemo(
    () => (rows || []).filter((row) => Number(row.is_active) === 1),
    [rows],
  );

  useEffect(() => {
    if (!editingId) {
      setForm(emptyForm);
    }
  }, [editingId]);

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    if (type === "file") {
      setForm((prev) => ({ ...prev, qrImageFile: files?.[0] || null }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const success = editingId
      ? await onUpdate(editingId, form)
      : await onSubmit(form);
    if (success) {
      setEditingId(null);
      setForm(emptyForm);
    }
    setSaving(false);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      paymentMode: row.payment_mode || "UPI",
      department: row.department || "Hotel",
      providerName: row.provider_name || "",
      upiId: row.upi_id || "",
      accountHolderName: row.account_holder_name || "",
      bankName: row.bank_name || "",
      qrImageUrl: row.qr_image_url || "",
      qrImageFile: null,
      isActive: Number(row.is_active) === 1,
      notes: row.notes || "",
    });
  };

  const removeRow = async (row) => {
    const confirmed = window.confirm("Delete this payment setup?");
    if (!confirmed) return;
    try {
      const success = await onDelete(row.id);
      if (success && editingId === row.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch {
      // Parent handles delete errors.
    }
  };

  return (
    <div className="space-y-5 rounded-[22px] border border-[#E4E1D8] bg-white/95 p-5 shadow-[0_20px_50px_rgba(30,64,175,0.1)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[15px] font-semibold uppercase tracking-[0.18em] text-[#0B4F48]">
            Payment Settings
          </div>
          <h3 className="mt-2 text-[15px] font-black text-[#1C231F]">UPI and scanner setup</h3>
          <p className="mt-2 max-w-3xl text-[15px] text-[#6B6F66]">
            Save the client&apos;s UPI ID, provider details, bank name, and QR scanner so staff can
            show the correct payment setup for hotel, restaurant, or banquet payments.
          </p>
        </div>
        <div className="rounded-[20px] border border-[#CFE7E2] bg-[#E4F0EE] px-4 py-3 text-[15px] text-[#0B4F48]">
          Active setups: <span className="font-bold">{activeRows.length}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            Payment Mode
          </span>
          <select
            name="paymentMode"
            value={form.paymentMode}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            Department
          </span>
          <select
            name="department"
            value={form.department}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="Hotel">Hotel</option>
            <option value="Restaurant">Restaurant</option>
            <option value="Banquet">Banquet</option>
            <option value="Accounts">Accounts</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            Provider Name
          </span>
          <input
            name="providerName"
            value={form.providerName}
            onChange={handleChange}
            className={inputClass}
            placeholder="Paytm, PhonePe, Google Pay"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            UPI ID
          </span>
          <input
            name="upiId"
            value={form.upiId}
            onChange={handleChange}
            className={inputClass}
            placeholder="hotelname@paytm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            Account Holder
          </span>
          <input
            name="accountHolderName"
            value={form.accountHolderName}
            onChange={handleChange}
            className={inputClass}
            placeholder="Maa Baglamkhi Resort"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            Bank Name
          </span>
          <input
            name="bankName"
            value={form.bankName}
            onChange={handleChange}
            className={inputClass}
            placeholder="State Bank of India"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            QR Image URL
          </span>
          <input
            name="qrImageUrl"
            value={form.qrImageUrl}
            onChange={handleChange}
            className={inputClass}
            placeholder="/uploads/payment-qr.png or external URL"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            Upload QR Image
          </span>
          <input
            name="qrImageFile"
            type="file"
            accept="image/*"
            onChange={handleChange}
            className={inputClass}
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-[15px] font-semibold uppercase tracking-[0.14em] text-[#1C231F]">
            Notes
          </span>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className={inputClass}
            placeholder="Use this setup for the front desk scanner."
          />
        </label>

        <label className="flex items-center gap-3 text-[15px] font-semibold text-[#1C231F]">
          <input
            type="checkbox"
            name="isActive"
            checked={form.isActive}
            onChange={handleChange}
            className="h-4 w-4 rounded border-[#E4E1D8]"
          />
          Keep this payment setup active
        </label>

        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 px-4 py-2 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Update Payment Setup" : "Save Payment Setup"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-[#E4E1D8] bg-white px-4 py-2 text-[15px] font-semibold text-slate-700"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeRows.map((row) => (
          <div
            key={row.id}
            className="rounded-[22px] border border-[#E4E1D8] bg-slate-50/90 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[15px] font-semibold uppercase tracking-[0.16em] text-[#1C231F]">
                  {row.department} {row.payment_mode}
                </div>
                <div className="mt-2 text-[15px] font-black text-[#1C231F]">
                  {row.provider_name || row.account_holder_name || "Payment Setup"}
                </div>
                <div className="mt-2 text-[15px] text-[#1C231F]">
                  UPI: {row.upi_id || "-"}
                </div>
                <div className="text-[15px] text-[#1C231F]">Bank: {row.bank_name || "-"}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[15px] font-bold text-cyan-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(row)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[15px] font-bold text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>

            {row.qr_image_url ? (
              <div className="mt-4 rounded-[18px] border border-[#E4E1D8] bg-white p-3">
                <img
                  src={row.qr_image_url}
                  alt={`${row.department} ${row.payment_mode} QR`}
                  className="mx-auto h-48 w-48 rounded-xl object-contain"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-dashed border-[#E4E1D8] bg-white p-5 text-center text-[15px] text-[#6B6F66]">
                No QR image uploaded yet.
              </div>
            )}

            {row.notes ? (
              <div className="mt-3 text-[15px] text-[#1C231F]">{row.notes}</div>
            ) : null}
          </div>
        ))}
        {!activeRows.length ? (
          <div className="rounded-[22px] border border-dashed border-[#E4E1D8] bg-slate-50 p-5 text-[15px] text-[#6B6F66] lg:col-span-2">
            No active UPI or scanner setup saved yet.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PaymentSettingsManager;

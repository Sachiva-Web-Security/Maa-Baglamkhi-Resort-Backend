import React, { useEffect, useMemo, useState } from "react";
import {
  createInventoryMasterRecord,
  deleteInventoryMasterRecord,
  fetchInventoryMasterRecords,
  updateInventoryMasterRecord,
} from "../../services/inventoryMastersService";
import {
  buildInitialMasterForm,
  INVENTORY_MASTER_SECTIONS,
} from "./inventoryMastersConfig";

function formatLabel(value) {
  return String(value || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function FieldInput({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Select {field.label}</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type || "text"}
      value={value}
      onChange={(e) => onChange(field.key, e.target.value)}
      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
    />
  );
}

export default function InventoryMastersManager() {
  const [activeKey, setActiveKey] = useState(INVENTORY_MASTER_SECTIONS[0].key);
  const [recordsBySection, setRecordsBySection] = useState({});
  const [draft, setDraft] = useState(buildInitialMasterForm(INVENTORY_MASTER_SECTIONS[0].fields));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeSection = useMemo(
    () => INVENTORY_MASTER_SECTIONS.find((section) => section.key === activeKey),
    [activeKey],
  );

  const loadSection = async (sectionKey) => {
    const rows = await fetchInventoryMasterRecords(sectionKey);
    setRecordsBySection((current) => ({
      ...current,
      [sectionKey]: rows,
    }));
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all(INVENTORY_MASTER_SECTIONS.map((section) => loadSection(section.key)));
      } catch (err) {
        setError(err.response?.data?.message || "Inventory masters could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  useEffect(() => {
    if (!activeSection) return;
    setDraft(buildInitialMasterForm(activeSection.fields));
    setEditingId(null);
    setMessage("");
    setError("");
  }, [activeSection]);

  const records = recordsBySection[activeKey] || [];

  const handleFieldChange = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setDraft(
      activeSection.fields.reduce((acc, field) => {
        acc[field.key] = row[field.key] ?? "";
        return acc;
      }, {}),
    );
  };

  const handleReset = () => {
    setEditingId(null);
    setDraft(buildInitialMasterForm(activeSection.fields));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingId) {
        await updateInventoryMasterRecord(activeKey, editingId, draft);
        setMessage(`${activeSection.label} updated successfully.`);
      } else {
        await createInventoryMasterRecord(activeKey, draft);
        setMessage(`${activeSection.label} created successfully.`);
      }
      await loadSection(activeKey);
      handleReset();
    } catch (err) {
      setError(err.response?.data?.message || "Could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setError("");
    setMessage("");
    try {
      await deleteInventoryMasterRecord(activeKey, id);
      await loadSection(activeKey);
      if (editingId === id) {
        handleReset();
      }
      setMessage(`${activeSection.label} record deleted.`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not be deleted.");
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading inventory masters...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Inventory Masters Manager</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ye standalone module inventory ke sab local-only master sections ko backend ke saath manage karne ke liye ready hai.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {INVENTORY_MASTER_SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActiveKey(section.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeKey === section.key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingId ? `Edit ${activeSection.label}` : `Add ${activeSection.label}`}
            </h3>
            <p className="mt-1 text-sm text-slate-500">Backend CRUD ready module</p>
          </div>

          <div className="space-y-4">
            {activeSection.fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {field.label} {field.required ? "*" : ""}
                </label>
                <FieldInput
                  field={field}
                  value={draft[field.key] ?? ""}
                  onChange={handleFieldChange}
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">{activeSection.label} Records</h3>
            <p className="mt-1 text-sm text-slate-500">{records.length} rows loaded from backend.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {activeSection.columns.map((column) => (
                    <th key={column} className="px-4 py-3">{formatLabel(column)}</th>
                  ))}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length ? records.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    {activeSection.columns.map((column) => (
                      <td key={column} className="px-4 py-3 text-slate-700">
                        {row[column] || "---"}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={activeSection.columns.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

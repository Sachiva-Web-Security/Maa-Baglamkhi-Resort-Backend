// src/pages/InventoryVendorsPage.jsx
// Vendors list — fetches from /api/inventory-masters/vendors
// Add / Edit via modal; Delete inline with confirmation.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimes,
  FaTruck,
  FaUser,
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaFileInvoice,
  FaToggleOn,
  FaCog,
  FaChevronLeft,
  FaChevronRight,
  FaBoxOpen,
} from "react-icons/fa";

import API, { getBackendBaseURL } from "../api";
import {
  createInventoryMasterRecord,
  deleteInventoryMasterRecord,
  fetchInventoryMasterRecords,
  updateInventoryMasterRecord,
} from "../services/inventoryMastersService";

/* ── shared style tokens (premium blue & white theme) ── */
const c = {
  ink: "#0F172A",
  paper: "#EEF3FC",
  panel: "#FFFFFF",
  line: "#E7ECF6",
  blue: "#2563EB",
  blueDeep: "#1D4ED8",
  blueSoft: "#EFF4FF",
  blueSofter: "#E7EEFF",
  green: "#16A34A",
  greenSoft: "#E7F7EC",
  rose: "#DC2626",
  roseSoft: "#FDECEC",
  muted: "#64748B",
  text: "#0F172A",
};

const fieldCls =
  "w-full rounded-2xl border border-[#E7ECF6] bg-white px-4 py-3.5 text-[15px] font-medium text-[#0F172A] shadow-[0_2px_10px_rgba(37,99,235,0.06)] transition-all duration-200 placeholder:text-[#94A3B8] placeholder:font-normal focus:border-[#2563EB] focus:outline-none focus:ring-4 focus:ring-[#2563EB]/10";

const labelCls = "mb-1.5 block text-[13px] font-semibold uppercase tracking-[0.04em] text-[#64748B]";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)] transition-all duration-200 hover:shadow-[0_10px_26px_rgba(37,99,235,0.38)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 whitespace-nowrap";

const primaryBtnStyle = { background: `linear-gradient(135deg, ${c.blue}, ${c.blueDeep})` };

const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-semibold transition-all duration-200 bg-white border border-[#E7ECF6] text-[#334155] hover:bg-[#F8FAFF] active:scale-[0.98]";

const rowActionBtn = (tone = "edit") => {
  const tones = {
    edit: "border-[#BFD6FE] bg-white text-[#2563EB] hover:bg-[#EFF4FF] hover:shadow-[0_4px_12px_rgba(37,99,235,0.15)]",
    danger: "border-transparent bg-[#FDECEC] text-[#DC2626] hover:bg-[#FBDADA] hover:shadow-[0_4px_12px_rgba(220,38,38,0.15)]",
  };
  return `inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold border transition-all duration-200 active:scale-[0.96] ${tones[tone] || tones.edit}`;
};

const statusBadge = (s) => {
  const key = String(s || "active").toLowerCase().trim();
  const isActive = key === "active";
  return {
    wrap: `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold shadow-sm shrink-0 ${
      isActive ? "bg-[#E7F7EC] text-[#16A34A]" : "bg-[#FDECEC] text-[#DC2626]"
    }`,
    dot: isActive ? "bg-[#16A34A]" : "bg-[#DC2626]",
  };
};

const THead = ({ icon: Icon, children }) => (
  <th className="text-left text-[13px] font-semibold uppercase tracking-[0.04em] text-[#475569] py-4 pr-4 border-b border-[#E7ECF6] whitespace-nowrap">
    <span className="inline-flex items-center gap-2">
      <Icon className="text-[#2563EB] text-[13px]" />
      {children}
    </span>
  </th>
);

/* ── Background decoration (soft blue gradient with abstract curves) ── */
const PageBackground = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <div
      className="absolute inset-0"
      style={{ background: "linear-gradient(160deg, #F5F8FE 0%, #EAF0FC 45%, #E3EBFB 100%)" }}
    />
    <svg
      className="absolute -top-10 -right-24 w-[620px] h-[620px] opacity-70"
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M300,40 C420,40 560,110 560,260 C560,410 430,520 290,520 C150,520 40,430 60,300 C80,170 180,40 300,40 Z"
        fill="url(#g1)"
      />
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DCE7FE" />
          <stop offset="100%" stopColor="#C9DAFC" />
        </linearGradient>
      </defs>
    </svg>
    <svg
      className="absolute bottom-[-140px] left-[-120px] w-[520px] h-[520px] opacity-60"
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="300" cy="300" r="260" fill="url(#g2)" />
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8F0FE" />
          <stop offset="100%" stopColor="#D3E1FD" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

/* ── Modal primitive ── */
const Modal = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0F172A]/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto rounded-[26px] bg-white p-6 sm:p-8 shadow-[0_30px_90px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h3 className="text-[22px] sm:text-[24px] font-bold text-[#0F172A] m-0">{title}</h3>
            {subtitle && <p className="text-[14px] sm:text-[15px] text-[#64748B] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[#64748B] transition hover:bg-[#F1F5FB] hover:text-[#0F172A]"
            aria-label="Close"
            type="button"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>
        <div className="text-[15px] leading-relaxed text-[#0F172A]">{children}</div>
        {actions && <div className="mt-7 flex flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </div>
  );
};

/* ── Toast ── */
const Toast = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const isSuccess = type === "success";
  const tone = isSuccess ? "bg-[#E7F7EC] text-[#16A34A]" : "bg-[#FDECEC] text-[#DC2626]";
  const Icon = isSuccess ? FaCheckCircle : FaExclamationTriangle;
  return (
    <div
      className={`fixed bottom-4 right-4 left-4 sm:bottom-6 sm:right-6 sm:left-auto z-[90] flex items-center gap-3 rounded-2xl border border-white/60 ${tone} px-4 py-3.5 sm:px-5 sm:py-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)] sm:max-w-sm`}
    >
      <Icon className="text-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-bold">{title}</div>
        <div className="text-[13px] opacity-80 truncate">{message}</div>
      </div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1.5 hover:bg-black/5">
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

/* ── Confirm delete modal ── */
const ConfirmDelete = ({ open, onClose, onConfirm, vendorName }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Delete vendor?"
    subtitle={`This will remove "${vendorName || "this vendor"}" permanently.`}
    actions={
      <>
        <button type="button" onClick={onClose} className={`${ghostBtn} w-full sm:w-auto`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(220,38,38,0.28)] transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] w-full sm:w-auto"
          style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
        >
          Delete
        </button>
      </>
    }
  >
    <p className="text-[15px] text-[#334155]">
      Are you sure? This action cannot be undone. Any linked purchase records will keep the vendor name for
      historical reference.
    </p>
  </Modal>
);

/* ── Vendor form modal ── */
const VendorFormModal = ({ open, onClose, onSave, initial }) => {
  const [form, setForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    city: "",
    gstin: "",
    status: "active",
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name || "",
          contact: initial.contact || "",
          phone: initial.phone || "",
          email: initial.email || "",
          city: initial.city || "",
          gstin: initial.gstin || "",
          status: initial.status || "active",
        });
      } else {
        setForm({ name: "", contact: "", phone: "", email: "", city: "", gstin: "", status: "active" });
      }
    }
  }, [open, initial]);

  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit vendor" : "Add vendor"}
      subtitle={initial ? "Update vendor details" : "Add a new supplier to your vendor list"}
      actions={
        <>
          <button type="button" onClick={onClose} className={`${ghostBtn} w-full sm:w-auto`}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className={`${primaryBtn} w-full sm:w-auto`} style={primaryBtnStyle}>
            {initial ? "Save changes" : "Add vendor"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="field">
          <label className={labelCls}>Vendor name *</label>
          <input
            className={fieldCls}
            placeholder="e.g. Sharma Traders"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Contact person</label>
          <input
            className={fieldCls}
            placeholder="e.g. Ramesh Sharma"
            value={form.contact}
            onChange={(e) => setField("contact", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Phone</label>
          <input
            className={fieldCls}
            placeholder="+91"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>Email</label>
          <input
            className={fieldCls}
            placeholder="vendor@email.com"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>City</label>
          <input
            className={fieldCls}
            placeholder="e.g. Delhi"
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
          />
        </div>
        <div className="field">
          <label className={labelCls}>GSTIN</label>
          <input
            className={fieldCls}
            placeholder="e.g. 07AABCS1234R1ZX"
            value={form.gstin}
            onChange={(e) => setField("gstin", e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

/* ── Vendor card (mobile / narrow screens) ── */
const VendorCard = ({ vendor, onEdit, onDelete }) => {
  const badge = statusBadge(vendor.status);
  const initial = (vendor.name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="p-4 border-b border-[#F1F5FB] last:border-b-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0"
            style={{ background: c.blueSofter, color: c.blueDeep }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[15.5px] text-[#0F172A] truncate">{vendor.name || "-"}</div>
            {vendor.contact && (
              <div className="text-[13px] text-[#64748B] truncate flex items-center gap-1.5 mt-0.5">
                <FaUser className="text-[10px] shrink-0" />
                <span className="truncate">{vendor.contact}</span>
              </div>
            )}
          </div>
        </div>
        <span className={badge.wrap}>
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          {vendor.status || "active"}
        </span>
      </div>

      {(vendor.phone || vendor.email || vendor.city || vendor.gstin) && (
        <div className="grid grid-cols-1 gap-2 mb-4 text-[14px] pl-[52px]">
          {vendor.phone && (
            <div className="flex items-center gap-2 text-[#334155] min-w-0">
              <FaPhoneAlt className="text-[#94A3B8] text-[12px] shrink-0" />
              <span className="truncate">{vendor.phone}</span>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-2 text-[#334155] min-w-0">
              <FaEnvelope className="text-[#94A3B8] text-[12px] shrink-0" />
              <span className="truncate">{vendor.email}</span>
            </div>
          )}
          {vendor.city && (
            <div className="flex items-center gap-2 text-[#334155] min-w-0">
              <FaMapMarkerAlt className="text-[#94A3B8] text-[12px] shrink-0" />
              <span className="truncate">{vendor.city}</span>
            </div>
          )}
          {vendor.gstin && (
            <div className="flex items-center gap-2 text-[#334155] min-w-0">
              <FaFileInvoice className="text-[#94A3B8] text-[12px] shrink-0" />
              <span className="truncate">{vendor.gstin}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onEdit} className={`${rowActionBtn("edit")} flex-1 !py-2.5`}>
          <FaEdit /> Edit
        </button>
        <button type="button" onClick={onDelete} className={`${rowActionBtn("danger")} flex-1 !py-2.5`}>
          <FaTrash /> Delete
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────── Main Component ─────────────────────────────── */

const InventoryVendorsPage = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ open: false, type: "success", title: "", message: "" });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await fetchInventoryMasterRecords("vendors");
      setVendors(Array.isArray(res) ? res : []);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      [v.name, v.contact, v.phone, v.email, v.city]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q)),
    );
  }, [vendors, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const handleSave = async (formData) => {
    try {
      if (editingVendor) {
        await updateInventoryMasterRecord("vendors", editingVendor.id, formData);
        setToast({ open: true, type: "success", title: "Vendor updated", message: `${formData.name} has been updated.` });
      } else {
        await createInventoryMasterRecord("vendors", formData);
        setToast({
          open: true,
          type: "success",
          title: "Vendor added",
          message: `${formData.name} has been added to your vendor list.`,
        });
      }
      setShowForm(false);
      setEditingVendor(null);
      await fetchVendors();
    } catch (err) {
      setToast({
        open: true,
        type: "error",
        title: "Save failed",
        message: err.response?.data?.message || "Could not save vendor.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteInventoryMasterRecord("vendors", deletingId);
      setToast({ open: true, type: "success", title: "Vendor deleted", message: "The vendor has been removed." });
      setDeletingId(null);
      await fetchVendors();
    } catch (err) {
      setToast({
        open: true,
        type: "error",
        title: "Delete failed",
        message: err.response?.data?.message || "Could not delete vendor.",
      });
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setEditingVendor(null);
    setShowForm(true);
  };

  const openEdit = (vendor) => {
    setEditingVendor(vendor);
    setShowForm(true);
  };

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden relative" style={{ color: c.text, width: "100%" }}>
      <PageBackground />

      <div className="w-full max-w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-10">
        {/* ── header ── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/inventory")}
              className="flex items-center gap-2 rounded-2xl bg-white px-3.5 sm:px-4 py-2.5 text-[14px] sm:text-[14.5px] font-semibold text-[#334155] shadow-[0_4px_14px_rgba(15,23,42,0.06)] ring-1 ring-[#E7ECF6] hover:bg-[#F8FAFF] hover:text-[#1D4ED8] active:scale-[0.98] transition shrink-0"
              title="Back to Items"
            >
              <FaArrowLeft className="text-sm" />
              Back
            </button>
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div
                className="w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] md:w-[52px] md:h-[52px] rounded-2xl flex items-center justify-center text-white text-[18px] sm:text-[20px] md:text-[22px] shrink-0 shadow-[0_10px_24px_rgba(37,99,235,0.35)]"
                style={{ background: `linear-gradient(135deg, ${c.blue}, ${c.blueDeep})` }}
              >
                <FaTruck />
              </div>
              <div className="min-w-0">
                <h1 className="text-[26px] sm:text-[32px] md:text-[36px] lg:text-[42px] font-bold m-0 leading-[1.1] tracking-tight text-[#0F172A]">
                  Vendors
                </h1>
                <p className="m-0 text-[14px] sm:text-[15px] md:text-[16px] lg:text-[19px] mt-0.5 truncate" style={{ color: c.muted }}>
                  Manage your suppliers and vendors
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className={`${primaryBtn} w-full md:w-auto`}
            style={primaryBtnStyle}
          >
            <FaPlus className="text-sm" /> Add Vendor
          </button>
        </div>

        {/* ── search ── */}
        <div className="mb-5 sm:mb-6">
          <div className="relative w-full">
            <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-[#94A3B8] text-[15px]" />
            <input
              className={`${fieldCls} pl-12`}
              placeholder="Search vendors by name, phone, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── table / cards ── */}
        <div className="bg-white border border-[#E7ECF6] rounded-[20px] sm:rounded-[24px] overflow-hidden shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          {/* Desktop / tablet table (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="bg-[#F8FAFF]">
                  <THead icon={FaUser}>Vendor Name</THead>
                  <THead icon={FaUser}>Contact</THead>
                  <THead icon={FaPhoneAlt}>Phone</THead>
                  <THead icon={FaEnvelope}>Email</THead>
                  <THead icon={FaMapMarkerAlt}>City</THead>
                  <THead icon={FaFileInvoice}>GSTIN</THead>
                  <THead icon={FaToggleOn}>Status</THead>
                  <th className="text-left text-[13px] font-semibold uppercase tracking-[0.04em] text-[#475569] py-4 pl-4 pr-6 border-b border-[#E7ECF6] w-[160px]">
                    <span className="inline-flex items-center gap-2">
                      <FaCog className="text-[#2563EB] text-[13px]" />
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-[#64748B] text-[16px]">
                      Loading vendors…
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center text-[32px] mb-5"
                          style={{ background: c.blueSoft, color: c.blue }}
                        >
                          <FaBoxOpen />
                        </div>
                        <b className="block text-[20px] sm:text-[22px] text-[#0F172A] mb-2">No vendors found</b>
                        <span className="text-[16px] sm:text-[18px] text-[#64748B] max-w-md">
                          Add your first vendor to start tracking suppliers.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((v) => {
                    const badge = statusBadge(v.status);
                    const initial = (v.name || "?").trim().charAt(0).toUpperCase();
                    return (
                      <tr
                        key={v.id}
                        className="border-b border-[#F1F5FB] last:border-b-0 hover:bg-[#F8FAFF] transition-colors duration-150"
                      >
                        <td className="py-4 pr-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0"
                              style={{ background: c.blueSofter, color: c.blueDeep }}
                            >
                              {initial}
                            </div>
                            <span className="font-bold text-[15.5px] text-[#0F172A] whitespace-nowrap">
                              {v.name || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-[14.5px] text-[#334155] whitespace-nowrap">{v.contact || "-"}</td>
                        <td className="py-4 pr-4 text-[14.5px] text-[#334155] whitespace-nowrap">{v.phone || "-"}</td>
                        <td className="py-4 pr-4 text-[14.5px] text-[#334155] whitespace-nowrap">{v.email || "-"}</td>
                        <td className="py-4 pr-4 text-[14.5px] text-[#334155] whitespace-nowrap">{v.city || "-"}</td>
                        <td className="py-4 pr-4 text-[14.5px] text-[#334155] whitespace-nowrap">{v.gstin || "-"}</td>
                        <td className="py-4 pr-4">
                          <span className={badge.wrap}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {v.status || "active"}
                          </span>
                        </td>
                        <td className="py-4 pl-4 pr-6">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEdit(v)} className={rowActionBtn("edit")}>
                              <FaEdit /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(v.id)}
                              className={rowActionBtn("danger")}
                              aria-label="Delete vendor"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet card list (below md) */}
          <div className="md:hidden">
            {loading ? (
              <div className="py-16 text-center text-[#64748B] text-[15px]">Loading vendors…</div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-14 px-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-[26px] mb-4"
                  style={{ background: c.blueSoft, color: c.blue }}
                >
                  <FaBoxOpen />
                </div>
                <b className="block text-[18px] text-[#0F172A] mb-2">No vendors found</b>
                <span className="text-[14.5px] text-[#64748B] max-w-xs">
                  Add your first vendor to start tracking suppliers.
                </span>
              </div>
            ) : (
              paginated.map((v) => (
                <VendorCard
                  key={v.id}
                  vendor={v}
                  onEdit={() => openEdit(v)}
                  onDelete={() => setDeletingId(v.id)}
                />
              ))
            )}
          </div>

          {/* ── pagination (shared) ── */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-[#F1F5FB]">
              <span className="text-[13px] sm:text-[13.5px] text-[#64748B] text-center sm:text-left">
                Showing {paginated.length} of {filtered.length} vendors
              </span>
              <div className="flex items-center flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#E7ECF6] bg-white text-[#334155] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFF] transition shrink-0"
                  aria-label="Previous page"
                >
                  <FaChevronLeft className="text-xs" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-[13.5px] font-semibold transition shrink-0 ${
                        n === page
                          ? "text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
                          : "border border-[#E7ECF6] bg-white text-[#334155] hover:bg-[#F8FAFF]"
                      }`}
                      style={n === page ? primaryBtnStyle : undefined}
                    >
                      {n}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#E7ECF6] bg-white text-[#334155] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFF] transition shrink-0"
                  aria-label="Next page"
                >
                  <FaChevronRight className="text-xs" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── modals ── */}
      <VendorFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingVendor(null);
        }}
        onSave={handleSave}
        initial={editingVendor}
      />
      <ConfirmDelete
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        vendorName={vendors.find((v) => v.id === deletingId)?.name}
      />
      <Toast open={toast.open} type={toast.type} title={toast.title} message={toast.message} onClose={closeToast} />
    </div>
  );
};

export default InventoryVendorsPage;
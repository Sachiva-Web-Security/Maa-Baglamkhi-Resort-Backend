import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBalanceScale, FaBoxes, FaClipboardList, FaExchangeAlt,
  FaFilter, FaFire, FaLayerGroup, FaListAlt, FaPlus, FaSearch,
  FaStore, FaTimes, FaTruck, FaUtensils, FaWarehouse, FaExclamationTriangle,
  FaCheckCircle, FaTrash, FaEdit, FaShoppingCart, FaFlask, FaChartBar,
  FaArrowRight, FaBell, FaCalendarAlt, FaChevronDown,
} from "react-icons/fa";
import API, { getBackendBaseURL } from "../../api";
import {
  createInventoryMasterRecord,
  deleteInventoryMasterRecord,
  fetchInventoryMasterRecords,
  updateInventoryMasterRecord,
} from "../../services/inventoryMastersService";

// ─── Constants ───────────────────────────────────────────────────────────────

const INVENTORY_SECTIONS = [
  { id: "items",              label: "Items",               icon: FaWarehouse,    type: "items" },
  { id: "menu-items",         label: "Menu Items",          icon: FaUtensils,     type: "menu" },
  { id: "menu-categories",    label: "Menu Categories",     icon: FaListAlt,      type: "master" },
  { id: "segments",           label: "Segments",            icon: FaLayerGroup,   type: "master" },
  { id: "vendors",            label: "Vendors",             icon: FaTruck,        type: "master" },
  { id: "units",              label: "Units",               icon: FaBalanceScale, type: "master" },
  { id: "store-kitchen",      label: "Store / Kitchen",     icon: FaStore,        type: "master" },
  { id: "item-groups",        label: "Item Groups",         icon: FaBoxes,        type: "master" },
  { id: "ingredients",        label: "Ingredients",         icon: FaFire,         type: "master" },
  { id: "purchase-items",     label: "Purchase Items",      icon: FaShoppingCart, type: "master" },
  { id: "purchase-services",  label: "Purchase Services",   icon: FaClipboardList,type: "master" },
  { id: "purchase-orders",    label: "Purchase Orders",     icon: FaClipboardList,type: "po" },
  { id: "stock-transfer",     label: "Stock Transfer",      icon: FaExchangeAlt,  type: "master" },
  { id: "waste-log",          label: "Waste / Spoilage",    icon: FaTrash,        type: "waste" },
  { id: "stock-audit",        label: "Stock Audit",         icon: FaCheckCircle,  type: "audit" },
  { id: "vendor-report",      label: "Vendor Report",       icon: FaListAlt,      type: "report" },
  { id: "stock-report",       label: "Stock Report",        icon: FaChartBar,     type: "report" },
  { id: "closing-stock-report",label:"Closing Stock Report",icon: FaListAlt,      type: "report" },
  { id: "item-report",        label: "Item Report",         icon: FaListAlt,      type: "report" },
  { id: "expiring-soon-report",label:"Expiring Soon",       icon: FaCalendarAlt,  type: "report" },
  { id: "batch-expiry-report", label:"Batch Expiry",        icon: FaListAlt,      type: "report" },
  { id: "item-consumption-report",label:"Consumption Report",icon:FaFlask,        type: "report" },
  { id: "total-consumption-report",label:"Total Consumption",icon:FaListAlt,      type: "report" },
  { id: "item-audit",         label: "Item Audit Report",   icon: FaListAlt,      type: "report" },
];

const NAVIGATION_GROUPS = [
  {
    label: "Stock",
    helper: "",
    ids: ["items", "menu-items", "stock-transfer", "stock-audit", "waste-log"],
    activeButton: "border-sky-300 bg-[linear-gradient(135deg,#2aa8de_0%,#3b82f6_100%)] text-white shadow-[0_18px_36px_rgba(14,165,233,0.22)]",
    idleButton: "border-sky-100 bg-[linear-gradient(135deg,#dff4ff_0%,#e8f1ff_100%)] text-cyan-950 hover:border-sky-200",
    dropdown: "border-cyan-200/80 bg-[linear-gradient(180deg,rgba(236,254,255,0.98)_0%,rgba(239,246,255,0.98)_100%)]",
    itemActive: "border-cyan-200 bg-white text-cyan-900 shadow-[0_14px_28px_rgba(8,145,178,0.10)]",
    itemIdle: "border-cyan-100/80 bg-white/90 text-slate-700 hover:border-cyan-200 hover:bg-white",
    iconTone: "bg-white/20 text-white",
    iconIdleTone: "bg-cyan-100 text-cyan-700",
  },
  {
    label: "Masters",
    helper: "Base masters and inventory setup",
    ids: ["menu-categories", "segments", "vendors", "units", "store-kitchen", "item-groups", "ingredients"],
    activeButton: "border-violet-300 bg-[linear-gradient(135deg,#8f7ae8_0%,#7ea5ff_100%)] text-white shadow-[0_18px_36px_rgba(124,58,237,0.22)]",
    idleButton: "border-violet-200 bg-[linear-gradient(135deg,#f1edff_0%,#e7edff_100%)] text-violet-950 hover:border-violet-300",
    dropdown: "border-violet-300/90 bg-[linear-gradient(180deg,rgba(237,233,254,0.99)_0%,rgba(219,234,254,0.99)_100%)]",
    itemActive: "border-violet-300 bg-white text-violet-950 shadow-[0_14px_28px_rgba(91,33,182,0.14)]",
    itemIdle: "border-violet-200/90 bg-white/95 text-slate-800 hover:border-violet-300 hover:bg-white",
    iconTone: "bg-white/20 text-white",
    iconIdleTone: "bg-violet-200 text-violet-900",
  },
  {
    label: "Purchases",
    helper: "Purchase entries, services and orders",
    ids: ["purchase-items", "purchase-services", "purchase-orders"],
    activeButton: "border-amber-300 bg-[linear-gradient(135deg,#f4c95b_0%,#f59e0b_100%)] text-amber-950 shadow-[0_18px_36px_rgba(245,158,11,0.18)]",
    idleButton: "border-amber-200 bg-[linear-gradient(135deg,#fff4d7_0%,#fff0bf_100%)] text-amber-950 hover:border-amber-300",
    dropdown: "border-amber-300/90 bg-[linear-gradient(180deg,rgba(255,237,213,0.99)_0%,rgba(254,243,199,0.99)_100%)]",
    itemActive: "border-amber-300 bg-white text-amber-950 shadow-[0_14px_28px_rgba(194,65,12,0.14)]",
    itemIdle: "border-amber-200/90 bg-white/95 text-slate-800 hover:border-amber-300 hover:bg-white",
    iconTone: "bg-white/20 text-white",
    iconIdleTone: "bg-amber-200 text-amber-900",
  },
  {
    label: "Reports",
    helper: "Operational and inventory reporting",
    ids: ["vendor-report", "stock-report", "closing-stock-report", "item-report", "expiring-soon-report", "batch-expiry-report", "item-consumption-report", "total-consumption-report", "item-audit"],
    activeButton: "border-emerald-300 bg-[linear-gradient(135deg,#6ad5b1_0%,#55c8c4_100%)] text-emerald-950 shadow-[0_18px_36px_rgba(16,185,129,0.18)]",
    idleButton: "border-emerald-200 bg-[linear-gradient(135deg,#dcfaed_0%,#d8f8f2_100%)] text-emerald-950 hover:border-emerald-300",
    dropdown: "border-emerald-300/90 bg-[linear-gradient(180deg,rgba(209,250,229,0.99)_0%,rgba(204,251,241,0.99)_100%)]",
    itemActive: "border-emerald-300 bg-white text-emerald-950 shadow-[0_14px_28px_rgba(4,120,87,0.14)]",
    itemIdle: "border-emerald-200/90 bg-white/95 text-slate-800 hover:border-emerald-300 hover:bg-white",
    iconTone: "bg-white/20 text-white",
    iconIdleTone: "bg-emerald-200 text-emerald-900",
  },
];

function generatePurchaseInvoiceNo() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `PINV-${stamp}`;
}

function buildSelectOptions(values = []) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

function normalizeInventoryText(value) {
  return String(value || "").trim().toLowerCase();
}

function getInventoryRowTimestamp(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    const parsed = new Date(text).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function getNormalizedNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const INVENTORY_INTERNAL_CSS = `
.inventory-ui-scope {
  font-family: "Roboto", "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

.inventory-ui-scope h1,
.inventory-ui-scope h2,
.inventory-ui-scope h3,
.inventory-ui-scope h4,
.inventory-ui-scope h5,
.inventory-ui-scope h6 {
  font-family: "Roboto", "Segoe UI", sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.inventory-ui-scope h1 { font-size: 32px; line-height: 1.15; }
.inventory-ui-scope h2 { font-size: 28px; line-height: 1.18; }
.inventory-ui-scope h3 { font-size: 24px; line-height: 1.2; }
.inventory-ui-scope h4,
.inventory-ui-scope h5,
.inventory-ui-scope h6 { font-size: 20px; line-height: 1.25; }

.inventory-ui-scope label,
.inventory-ui-scope .inventory-form-label {
  font-family: "Poppins", "Segoe UI", sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 1.4;
}

@media (min-width: 768px) {
  .inventory-ui-scope label,
  .inventory-ui-scope .inventory-form-label {
    font-size: 14px;
  }
}

.inventory-ui-scope input,
.inventory-ui-scope select,
.inventory-ui-scope textarea,
.inventory-ui-scope .inventory-field-text {
  font-family: "Roboto", "Segoe UI", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.45;
}

@media (min-width: 768px) {
  .inventory-ui-scope input,
  .inventory-ui-scope select,
  .inventory-ui-scope textarea,
  .inventory-ui-scope .inventory-field-text {
    font-size: 16px;
  }
}

.inventory-ui-scope p,
.inventory-ui-scope span,
.inventory-ui-scope td,
.inventory-ui-scope th,
.inventory-ui-scope li,
.inventory-ui-scope small,
.inventory-ui-scope .inventory-body-text {
  font-family: "Roboto", "Segoe UI", sans-serif;
  font-weight: 400;
}

.inventory-ui-scope p,
.inventory-ui-scope td,
.inventory-ui-scope th,
.inventory-ui-scope .inventory-body-text {
  font-size: 14px;
  line-height: 1.5;
}

@media (min-width: 768px) {
  .inventory-ui-scope p,
  .inventory-ui-scope td,
  .inventory-ui-scope th,
  .inventory-ui-scope .inventory-body-text {
    font-size: 16px;
  }
}

.inventory-ui-scope button,
.inventory-ui-scope .inventory-button-text {
  font-family: "Roboto", "Segoe UI", sans-serif;
  font-weight: 500;
}
`;

const UNIT_PRESETS = [
  { name: "Kilogram", shortName: "kg", type: "Weight" },
  { name: "Gram", shortName: "g", type: "Weight" },
  { name: "Quintal", shortName: "qtl", type: "Weight" },
  { name: "Litre", shortName: "ltr", type: "Volume" },
  { name: "Millilitre", shortName: "ml", type: "Volume" },
  { name: "Piece", shortName: "pcs", type: "Count" },
  { name: "Dozen", shortName: "doz", type: "Count" },
  { name: "Packet", shortName: "pkt", type: "Count" },
  { name: "Bottle", shortName: "btl", type: "Count" },
  { name: "Box", shortName: "box", type: "Count" },
  { name: "Tray", shortName: "tray", type: "Count" },
];

function findUnitPreset(value, key = "name") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return UNIT_PRESETS.find((preset) => String(preset[key] || "").trim().toLowerCase() === normalized) || null;
}

const SEGMENT_PRESETS = [
  { name: "Food", description: "Kitchen raw materials and cooking stock" },
  { name: "Beverage", description: "Cold drinks, tea, coffee, juices and bar supplies" },
  { name: "Housekeeping", description: "Cleaning materials and housekeeping consumables" },
  { name: "Linen", description: "Bed sheets, towels, blankets and room linen" },
  { name: "Kitchen", description: "Kitchen support items and preparation supplies" },
  { name: "Bar", description: "Bar stock, mixers and serving materials" },
  { name: "Banquet", description: "Banquet event stock and service materials" },
  { name: "Maintenance", description: "Repair, electrical and plumbing items" },
  { name: "Consumables", description: "Daily-use consumable stock items" },
  { name: "Packaging", description: "Packing, takeaway and storage materials" },
  { name: "Cleaning Supplies", description: "Detergents, cleaners and sanitation stock" },
  { name: "Guest Supplies", description: "Guest amenities and room-use consumables" },
  { name: "Stationery", description: "Office and operational stationery items" },
];

function findSegmentPreset(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return SEGMENT_PRESETS.find((preset) => String(preset.name || "").trim().toLowerCase() === normalized) || null;
}

const ITEM_GROUP_PRESETS = {
  Food: ["Dairy", "Grain", "Spice", "Vegetables", "Fruits", "Pulses", "Dry Fruits", "Bakery", "Frozen Items", "Meat", "Seafood", "Oil & Ghee"],
  Beverage: ["Soft Drinks", "Juices", "Tea Coffee", "Water", "Syrups", "Mocktail Supplies", "Bar Mixers"],
  Housekeeping: ["Cleaning Chemicals", "Toiletries", "Room Amenities", "Tissue & Paper", "Dusting Supplies", "Laundry Supplies"],
  Linen: ["Bed Linen", "Bath Linen", "Curtains", "Pillow Covers", "Blankets"],
  Kitchen: ["Preparation Supplies", "Cooking Essentials", "Service Tools", "Storage Containers"],
  Bar: ["Alcoholic Beverages", "Mixers", "Glassware", "Bar Garnish", "Bar Consumables"],
  Banquet: ["Serving Supplies", "Buffet Setup", "Event Consumables", "Banquet Crockery"],
  Maintenance: ["Electrical", "Plumbing", "Hardware", "Repair Tools"],
  Consumables: ["Daily Use", "Single Use", "Operational Consumables"],
  Packaging: ["Takeaway Containers", "Carry Bags", "Wrapping Material", "Storage Packaging"],
  "Cleaning Supplies": ["Floor Care", "Surface Cleaners", "Washroom Supplies", "Disinfectants"],
  "Guest Supplies": ["Amenities", "Room Supplies", "Welcome Kit"],
  Stationery: ["Office Stationery", "Billing Stationery", "Registers"],
};

const MASTER_WORKSPACE_IDS = [
  "menu-categories",
  "units",
  "vendors",
  "item-groups",
  "store-kitchen",
  "ingredients",
];

const STORAGE_KEYS = {
  segments: "inventory_segments",
  vendors: "inventory_vendors",
  units: "inventory_units",
  "store-kitchen": "inventory_store_kitchen",
  "item-groups": "inventory_item_groups",
  ingredients: "inventory_ingredients",
  "purchase-items": "inventory_purchase_items",
  "purchase-services": "inventory_purchase_services",
  "stock-transfer": "inventory_stock_transfer",
  "purchase-orders": "inventory_purchase_orders",
  "waste-log": "inventory_waste_log",
  "menu-items": "inventory_menu_items",
  "menu-categories": "inventory_menu_categories",
};

const INVENTORY_MASTER_API_SECTION_MAP = {
  "menu-categories": "menu-categories",
  segments: "segments",
  vendors: "vendors",
  units: "units",
  "store-kitchen": "locations",
  "item-groups": "item-groups",
  ingredients: "ingredients",
  "purchase-items": "purchase-items",
  "purchase-services": "purchase-services",
};

const API_BACKED_MASTER_SECTIONS = new Set(Object.keys(INVENTORY_MASTER_API_SECTION_MAP));

const MENU_ITEM_FIELDS = [
  { key: "name", label: "Dish Name", type: "text", required: true },
  { key: "category", label: "Category", type: "text", required: true },
  { key: "price", label: "Price", type: "number", required: true },
  { key: "imageFile", label: "Upload Image", type: "file" },
  { key: "imageUrl", label: "Image URL", type: "text" },
  { key: "description", label: "Description", type: "text" },
  { key: "foodType", label: "Food Type", type: "select", options: ["Veg", "Non Veg", "Egg"] },
  { key: "status", label: "Status", type: "select", options: ["Available", "Out of Stock"] },
];

const MASTER_FIELDS = {
  segments: [
    { key: "name", label: "Segment Name", type: "text", required: true },
    { key: "description", label: "Description", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
  ],
  vendors: [
    { key: "name", label: "Vendor Name", type: "text", required: true },
    { key: "contact", label: "Contact Person", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "city", label: "City", type: "text" },
    { key: "gstin", label: "GSTIN", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["Active", "On Hold", "Blacklisted"] },
  ],
  units: [
    { key: "name", label: "Unit Name", type: "text", required: true },
    { key: "shortName", label: "Short Name", type: "text", required: true },
    { key: "type", label: "Type", type: "select", options: ["Weight", "Volume", "Count"] },
  ],
  "store-kitchen": [
    { key: "name", label: "Store Name", type: "text", required: true },
    { key: "type", label: "Type", type: "select", options: ["Store", "Kitchen", "Bar", "Banquet"] },
    { key: "manager", label: "Manager", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
  ],
  "item-groups": [
    { key: "name", label: "Group Name", type: "text", required: true },
    { key: "segment", label: "Segment", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
  ],
  ingredients: [
    { key: "name", label: "Ingredient Name", type: "text", required: true },
    { key: "group", label: "Group", type: "text" },
    { key: "unit", label: "Unit", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
  ],
  "purchase-items": [
    { key: "itemName", label: "Item Name", type: "text", required: true },
    { key: "vendor", label: "Vendor", type: "text", required: true },
    { key: "quantity", label: "Quantity", type: "number", required: true },
    { key: "unit", label: "Unit", type: "text" },
    { key: "ratePerUnit", label: "Rate / Unit (₹)", type: "number" },
    { key: "amount", label: "Total Amount (₹)", type: "number", required: true },
    { key: "invoiceNo", label: "Invoice No", type: "text" },
    { key: "date", label: "Date", type: "date", required: true },
  ],
  "purchase-services": [
    { key: "serviceName", label: "Service Name", type: "text", required: true },
    { key: "vendor", label: "Vendor", type: "text", required: true },
    { key: "amount", label: "Amount (₹)", type: "number", required: true },
    { key: "date", label: "Date", type: "date", required: true },
    { key: "status", label: "Status", type: "select", options: ["Pending", "Completed", "Cancelled"] },
  ],
  "stock-transfer": [
    { key: "itemName", label: "Item Name", type: "text", required: true },
    { key: "fromStore", label: "From Department", type: "text", required: true },
    { key: "toStore", label: "To Department", type: "text", required: true },
    { key: "quantity", label: "Quantity", type: "number", required: true },
    { key: "unit", label: "Unit", type: "text" },
    { key: "approvedBy", label: "Approved By", type: "text" },
    { key: "notes", label: "Notes", type: "text" },
    { key: "date", label: "Date", type: "date", required: true },
  ],
  "menu-categories": [
    { key: "name", label: "Category Name", type: "text", required: true },
    { key: "parent", label: "Parent Group", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
  ],
};

const MASTER_TABLE_COLUMNS = {
  segments: ["name", "description", "status"],
  vendors: ["name", "contact", "phone", "city", "gstin", "status"],
  units: ["name", "shortName", "type"],
  "store-kitchen": ["name", "type", "manager", "status"],
  "item-groups": ["name", "segment", "status"],
  ingredients: ["name", "group", "unit", "status"],
  "purchase-items": ["itemName", "vendor", "quantity", "unit", "ratePerUnit", "amount", "invoiceNo", "date"],
  "purchase-services": ["serviceName", "vendor", "amount", "date", "status"],
  "stock-transfer": ["itemName", "fromStore", "toStore", "quantity", "unit", "approvedBy", "notes", "date"],
  "menu-categories": ["name", "parent", "status"],
};

const ITEMS_FORM = [
  { key: "name",         label: "Item Name",       type: "text",   required: true },
  { key: "category",     label: "Category",         type: "text",   required: true },
  { key: "stock",        label: "Current Stock",    type: "number", required: true },
  { key: "unit",         label: "Unit",             type: "text",   required: true },
  { key: "price",        label: "Price / Unit (₹)", type: "number", required: true },
  { key: "reorderPoint", label: "Reorder Point",    type: "number" },
  { key: "expiry",       label: "Expiry Date",      type: "date" },
  { key: "branch",       label: "Store / Branch",   type: "text",   required: true },
];

const PO_FIELDS = [
  { key: "poNumber",     label: "PO Number",        type: "text",   required: true },
  { key: "vendor",       label: "Vendor",           type: "text",   required: true },
  { key: "itemName",     label: "Item Name",        type: "text",   required: true },
  { key: "quantity",     label: "Quantity",         type: "number", required: true },
  { key: "unit",         label: "Unit",             type: "text" },
  { key: "rate",         label: "Rate / Unit (₹)",  type: "number", required: true },
  { key: "expectedDate", label: "Expected Delivery",type: "date" },
  { key: "status",       label: "Status",           type: "select", options: ["Draft","Sent","GRN Received","Closed","Cancelled"] },
];

const WASTE_FIELDS = [
  { key: "itemName",  label: "Item Name",       type: "text",   required: true },
  { key: "quantity",  label: "Quantity Lost",   type: "number", required: true },
  { key: "unit",      label: "Unit",            type: "text" },
  { key: "reason",    label: "Reason",          type: "select", options: ["Expired","Spoiled","Damaged","Overcooked","Spilled","Other"] },
  { key: "store",     label: "From Store",      type: "text" },
  { key: "remarks",   label: "Remarks",         type: "text" },
  { key: "date",      label: "Date",            type: "date",   required: true },
];

const DEFAULT_MASTER_DATA = {
  segments: [
    { id: 1, name: "Food", description: "Kitchen raw material", status: "Active" },
    { id: 2, name: "Beverage", description: "Soft drinks and mocktails", status: "Active" },
  ],
  vendors: [
    { id: 1, name: "Fresh Farm Supply", contact: "Ravi", phone: "9876543210", email: "", city: "Varanasi", gstin: "", status: "Active" },
    { id: 2, name: "Royal Traders", contact: "Amit", phone: "9988776655", email: "", city: "Mirzapur", gstin: "", status: "On Hold" },
  ],
  units: [
    { id: 1, name: "Kilogram", shortName: "kg", type: "Weight" },
    { id: 2, name: "Litre", shortName: "ltr", type: "Volume" },
    { id: 3, name: "Piece", shortName: "pcs", type: "Count" },
  ],
  "store-kitchen": [
    { id: 1, name: "Main Store", type: "Store", manager: "Mohan", status: "Open" },
    { id: 2, name: "Live Kitchen", type: "Kitchen", manager: "Chef Arjun", status: "Open" },
    { id: 3, name: "Bar Counter", type: "Bar", manager: "Suresh", status: "Open" },
    { id: 4, name: "Banquet Store", type: "Banquet", manager: "Dinesh", status: "Open" },
  ],
  "item-groups": [
    { id: 1, name: "Dry Store", segment: "Food", status: "Active" },
    { id: 2, name: "Cold Storage", segment: "Food", status: "Active" },
  ],
  ingredients: [
    { id: 1, name: "Basmati Rice", group: "Dry Store", unit: "kg", status: "Active" },
    { id: 2, name: "Cooking Oil", group: "Kitchen Essentials", unit: "ltr", status: "Active" },
  ],
  "purchase-items": [
    { id: 1, itemName: "Paneer", vendor: "Fresh Farm Supply", quantity: 20, unit: "kg", ratePerUnit: 240, amount: 4800, invoiceNo: "INV-001", date: "2026-03-14" },
    { id: 2, itemName: "Cold Drink", vendor: "Royal Traders", quantity: 48, unit: "pcs", ratePerUnit: 75, amount: 3600, invoiceNo: "INV-002", date: "2026-03-15" },
  ],
  "purchase-services": [
    { id: 1, serviceName: "Deep Cleaning", vendor: "Royal Traders", amount: 4500, date: "2026-03-12", status: "Completed" },
  ],
  "stock-transfer": [
    { id: 1, itemName: "Soft Drinks", fromStore: "Main Store", toStore: "Bar Counter", quantity: 24, unit: "pcs", approvedBy: "Manager", date: "2026-03-15" },
  ],
  "purchase-orders": [
    { id: 1, poNumber: "PO-001", vendor: "Fresh Farm Supply", itemName: "Basmati Rice", quantity: 50, unit: "kg", rate: 85, expectedDate: "2026-03-28", status: "Sent" },
  ],
  "waste-log": [
    { id: 1, itemName: "Paneer", quantity: 2, unit: "kg", reason: "Expired", store: "Live Kitchen", remarks: "Past expiry date", date: "2026-03-15" },
  ],
  "menu-categories": [
    { id: 1, name: "Veg Starter", parent: "Starters", status: "Active" },
    { id: 2, name: "Non Veg Starter", parent: "Starters", status: "Active" },
    { id: 3, name: "Soups", parent: "Starters", status: "Active" },
    { id: 4, name: "Salads", parent: "Starters", status: "Active" },
    { id: 5, name: "Main Course Veg", parent: "Main Course", status: "Active" },
    { id: 6, name: "Main Course Non Veg", parent: "Main Course", status: "Active" },
    { id: 7, name: "Breads", parent: "Main Course", status: "Active" },
    { id: 8, name: "Rice & Biryani", parent: "Main Course", status: "Active" },
    { id: 9, name: "Chinese", parent: "Speciality", status: "Active" },
    { id: 10, name: "South Indian", parent: "Speciality", status: "Active" },
    { id: 11, name: "Snacks", parent: "Quick Bites", status: "Active" },
    { id: 12, name: "Fast Food", parent: "Quick Bites", status: "Active" },
    { id: 13, name: "Combos", parent: "Meals", status: "Active" },
    { id: 14, name: "Thali", parent: "Meals", status: "Active" },
    { id: 15, name: "Breakfast", parent: "Meals", status: "Active" },
    { id: 16, name: "Beverages", parent: "Drinks", status: "Active" },
    { id: 17, name: "Mocktails", parent: "Drinks", status: "Active" },
    { id: 18, name: "Tea & Coffee", parent: "Drinks", status: "Active" },
    { id: 19, name: "Desserts", parent: "Sweet Section", status: "Active" },
    { id: 20, name: "Sweets", parent: "Sweet Section", status: "Active" },
    { id: 21, name: "Ice Cream", parent: "Sweet Section", status: "Active" },
    { id: 22, name: "Jain Food", parent: "Speciality", status: "Active" },
    { id: 23, name: "Kids Menu", parent: "Speciality", status: "Active" },
    { id: 24, name: "Tandoor", parent: "Speciality", status: "Active" },
  ],
  "menu-items": [
    { id: 1, name: "Paneer Butter Masala", category: "Main Course", price: 280, imageUrl: "", description: "Rich tomato gravy with soft paneer cubes.", foodType: "Veg", status: "Available" },
    { id: 2, name: "Veg Thali", category: "Combos", price: 250, imageUrl: "", description: "Complete thali with sabzi, dal, rice and roti.", foodType: "Veg", status: "Available" },
  ],
};
const PRESET_MENU_CATEGORY_OPTIONS = Array.from(
  new Set(
    [
      ...(DEFAULT_MASTER_DATA["menu-categories"] || []).flatMap((item) => [
        String(item.name || "").trim(),
        String(item.parent || "").trim(),
      ]),
      "Starters",
      "Veg Starters",
      "Non Veg Starters",
      "Soups",
      "Salads",
      "Main Course",
      "Main Course Veg",
      "Main Course Non Veg",
      "Breads",
      "Rice",
      "Rice & Biryani",
      "Dal Specials",
      "Tandoor",
      "Chinese",
      "South Indian",
      "North Indian",
      "Punjabi",
      "Jain Food",
      "Breakfast",
      "Snacks",
      "Fast Food",
      "Street Food",
      "Quick Bites",
      "Meals",
      "Combos",
      "Thali",
      "Desserts",
      "Sweets",
      "Ice Cream",
      "Bakery",
      "Beverage",
      "Beverages",
      "Cold Beverages",
      "Hot Beverages",
      "Mocktails",
      "Tea & Coffee",
      "Shakes",
      "Juices",
      "Kids Menu",
      "Chef Specials",
    ].filter(Boolean),
  ),
).sort((a, b) => a.localeCompare(b));

// ─── Utility Functions ────────────────────────────────────────────────────────

function loadStoredValue(key, fallback) {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return fallback;
    }
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStoredValue(key, value) {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write issues such as private mode or quota failures.
  }
}

function buildInitialForm(fields, record = {}) {
  return fields.reduce((acc, field) => {
    acc[field.key] = record[field.key] ?? "";
    return acc;
  }, {});
}

function formatLabel(value) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatQuantity(value) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, "");
}

function resolveAssetUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${getBackendBaseURL()}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
}

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  const exp = new Date(expiryDate);
  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0)  return { label: "Expired",      color: "bg-red-100 text-red-700 border-red-300" };
  if (diffDays <= 7) return { label: `Exp in ${diffDays}d`, color: "bg-orange-100 text-orange-700 border-orange-300" };
  if (diffDays <= 30) return { label: `Exp in ${diffDays}d`, color: "bg-amber-100 text-amber-700 border-amber-300" };
  return null;
}

function isLowStock(item) {
  const stock = Number(item.stock || 0);
  const reorder = Number(item.reorderPoint || 10);
  return stock <= reorder;
}

// ─── Small Shared Components ──────────────────────────────────────────────────

function FormInput({ field, value, onChange }) {
  const cls = "w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-[18px] font-semibold text-slate-950 outline-none transition placeholder:text-[18px] placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100";
  if (field.type === "select" && field.allowCustom) {
    const options = Array.isArray(field.options) ? field.options : [];
    const isPresetValue = !value || options.includes(value);
    const selectValue = isPresetValue ? value : "__custom__";

    return (
      <div className="space-y-3">
        <select value={selectValue} onChange={(e) => onChange(field.key, e.target.value === "__custom__" ? "" : e.target.value)} className={cls}>
          <option value="">Select {field.label}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value="__custom__">Other (Custom)</option>
        </select>
        {selectValue === "__custom__" ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={cls}
            placeholder={field.customPlaceholder || `Enter ${field.label}`}
          />
        ) : null}
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(field.key, e.target.value)} className={cls}>
        <option value="">Select {field.label}</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "file") {
    return (
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(field.key, e.target.files?.[0] || null)}
        className={cls}
      />
    );
  }
  const datalistId = field.suggestions?.length ? `field-suggestions-${field.key.replace(/[^a-z0-9]/gi, "-").toLowerCase()}` : undefined;
  return (
    <>
      <input type={field.type} value={value} onChange={(e) => onChange(field.key, e.target.value)}
        list={datalistId}
        className={cls} placeholder={field.label} />
      {datalistId ? (
        <datalist id={datalistId}>
          {field.suggestions.map((option) => <option key={option} value={option} />)}
        </datalist>
      ) : null}
    </>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-4 py-3.5 text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition focus-within:-translate-y-0.5 focus-within:border-cyan-200">
      <FaSearch className="shrink-0 text-cyan-500" size={14} />
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[17px] outline-none placeholder:text-[16px] placeholder:text-slate-400" />
    </label>
  );
}

function Badge({ children, color = "gray" }) {
  const colors = {
    gray: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    cyan: "bg-cyan-100 text-cyan-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-block rounded-full px-4 py-1.5 text-base font-semibold ${colors[color]}`}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, sub, tone = "default" }) {
  const tones = {
    default: "from-white to-slate-50 border-slate-200 shadow-[0_18px_40px_rgba(15,23,42,0.06)]",
    cyan:    "from-cyan-50 to-sky-100 border-cyan-200 shadow-[0_18px_40px_rgba(8,145,178,0.12)]",
    amber:   "from-amber-50 to-orange-100 border-amber-200 shadow-[0_18px_40px_rgba(245,158,11,0.12)]",
    emerald: "from-emerald-50 to-teal-100 border-emerald-200 shadow-[0_18px_40px_rgba(16,185,129,0.12)]",
    red:     "from-rose-50 to-red-100 border-red-200 shadow-[0_18px_40px_rgba(244,63,94,0.12)]",
  };
  return (
    <div className={`relative overflow-hidden rounded-[24px] border bg-gradient-to-br px-4 py-4 ${tones[tone]}`}>
      <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-white/40 blur-2xl" />
      <p className="inventory-form-label text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="mt-1.5 font-bold text-slate-900 text-[20px] leading-[1.2] md:text-[32px]">{value}</p>
      {sub && <p className="inventory-body-text mt-0.5 text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Form Panel + Table ───────────────────────────────────────────────────────

function FormPanel({ title, subtitle, fields, draft, setDraft, editingId, onSave, onReset, onFieldChange }) {
  const orderedFields =
    title === "Stock Transfer"
      ? [
          ...["itemName", "toStore", "fromStore", "quantity", "unit", "approvedBy", "notes", "date"]
            .map((key) => fields.find((field) => field.key === key))
            .filter(Boolean),
          ...fields.filter(
            (field) =>
              !["itemName", "toStore", "fromStore", "quantity", "unit", "approvedBy", "notes", "date"].includes(
                field.key,
              ),
          ),
        ]
      : fields;

  const fieldRows = [];
  for (let index = 0; index < orderedFields.length; index += 2) {
    fieldRows.push(orderedFields.slice(index, index + 2));
  }

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.96)_100%)] p-5 shadow-[0_28px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
      <div className="mb-5 rounded-[26px] border border-slate-900/10 bg-[linear-gradient(135deg,#0f172a_0%,#14532d_36%,#0f766e_100%)] px-5 py-5 text-white shadow-[0_22px_45px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-100/90">
              Inventory Form
            </div>
            <h3 className="mt-2 text-3xl font-semibold">
              {editingId ? `Edit ${title}` : `Add ${title}`}
            </h3>
            {subtitle && <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">{subtitle}</p>}
          </div>
          {editingId && (
            <button type="button" onClick={onReset}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
              Cancel Edit
            </button>
          )}
        </div>
      </div>
      <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[16px] font-semibold uppercase tracking-[0.18em] text-slate-700">Quick Entry</div>
            <div className="mt-1 text-[16px] font-semibold text-slate-700">Single-line field layout for faster inventory updates.</div>
          </div>
          <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-[14px] font-semibold text-cyan-800">
            {fields.length} fields
          </div>
        </div>
        <div className="space-y-3">
        {fieldRows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="grid gap-3 sm:grid-cols-2">
            {row.map((field) => (
              <div key={field.key} className="rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
                  <label className="w-full shrink-0 text-[16px] font-semibold uppercase tracking-[0.22em] text-slate-700 lg:w-[160px]">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <div className="min-w-0 flex-1">
                    <FormInput field={field} value={draft[field.key] ?? ""}
                      onChange={(key, val) => {
                        if (onFieldChange) {
                          onFieldChange(key, val);
                          return;
                        }
                        setDraft((c) => ({ ...c, [key]: val }));
                      }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button type="button" onClick={onSave}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 px-6 py-3 text-[16px] font-semibold text-white shadow-[0_18px_30px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5">
          <FaPlus size={12} />
          {editingId ? "Update" : "Save"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[16px] font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          Reset Form
        </button>
      </div>
      </div>
    </div>
  );
}

function DataTable({ columns, rows, onEdit, onDelete, emptyMessage }) {
  const DATA_TABLE_PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / DATA_TABLE_PAGE_SIZE));
  const paginatedRows = rows.slice(
    (page - 1) * DATA_TABLE_PAGE_SIZE,
    page * DATA_TABLE_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [rows, columns]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="overflow-x-auto">
      <table className="min-w-full text-base text-slate-700">
        <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-left text-sm font-semibold uppercase tracking-widest text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-4">{formatLabel(col)}</th>
            ))}
            {(onEdit || onDelete) && <th className="px-4 py-4">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? paginatedRows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 hover:bg-cyan-50/40 transition">
              {columns.map((col) => (
                <td key={col} className="px-4 py-3 text-slate-700">{row[col] ?? "—"}</td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {onEdit && (
                      <button type="button" onClick={() => onEdit(row)}
                        className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100">
                        <FaEdit size={10} /> Edit
                      </button>
                    )}
                    {onDelete && (
                      <button type="button" onClick={() => onDelete(row.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-100">
                        <FaTrash size={10} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-base text-slate-400">
                {emptyMessage || "No records found."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {rows.length > DATA_TABLE_PAGE_SIZE ? (
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-base text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {(page - 1) * DATA_TABLE_PAGE_SIZE + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-900">
              {Math.min(page * DATA_TABLE_PAGE_SIZE, rows.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{rows.length}</span> records
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  pageNumber === page
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionTabs({
  activeTab,
  onChange,
  listLabel,
  listHelper,
  formLabel,
  formHelper,
  segmented = false,
  listIcon: ListIcon = FaClipboardList,
  formIcon: FormIcon = FaPlus,
}) {
  if (segmented) {
    return (
      <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200/90 bg-[#f1f3f5] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        {[
          { id: "list", label: listLabel, Icon: ListIcon },
          { id: "form", label: formLabel, Icon: FormIcon },
        ].map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.Icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-full px-5 text-[16px] font-semibold transition-all duration-200 ${
                active
                  ? "bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] text-white shadow-[0_10px_22px_rgba(37,99,235,0.26)]"
                  : "bg-transparent text-slate-700 hover:bg-white/70"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                  active ? "bg-white/18 text-white" : "bg-white text-slate-500"
                }`}
              >
                <Icon size={12} />
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="flex flex-wrap gap-3">
        {[
          { id: "list", label: listLabel, helper: listHelper },
          { id: "form", label: formLabel, helper: formHelper },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`min-w-[220px] rounded-[22px] border px-5 py-4 text-left transition ${
                active
                  ? "border-cyan-300 bg-[linear-gradient(135deg,#ecfeff_0%,#dbeafe_100%)] shadow-[0_18px_35px_rgba(14,165,233,0.16)]"
                  : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/60"
              }`}
            >
              <div className={`text-2xl font-black uppercase tracking-[0.18em] ${active ? "text-cyan-700" : "text-slate-700"}`}>
                {tab.label}
              </div>
              <div className={`mt-1 text-xl ${active ? "text-cyan-700/80" : "text-slate-500"}`}>
                {tab.helper}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section: Items ───────────────────────────────────────────────────────────

function InventoryHeaderStrip({
  summaryMetrics,
  activeGroupLabel,
  setOpenNavGroup,
  setActiveSection,
}) {
  const overviewCards = [
    { key: "total", label: "Total Items", value: summaryMetrics.totalItems, icon: FaWarehouse, accent: "from-sky-50 to-blue-50", iconTone: "bg-sky-100 text-sky-600", valueTone: "text-slate-950", meta: "+12%" },
    { key: "value", label: "Stock Value", value: formatCurrency(summaryMetrics.totalStockValue), icon: FaChartBar, accent: "from-violet-50 to-indigo-50", iconTone: "bg-violet-100 text-violet-600", valueTone: "text-slate-950", meta: "Live backend sync" },
    { key: "low", label: "Low Stock", value: `${summaryMetrics.lowStockCount} Items`, icon: FaExclamationTriangle, accent: "from-amber-50 to-orange-50", iconTone: "bg-amber-100 text-amber-600", valueTone: "text-orange-600", meta: "Needs reorder" },
    { key: "expired", label: "Expired", value: `${summaryMetrics.expiredCount} Items`, icon: FaCalendarAlt, accent: "from-rose-50 to-red-50", iconTone: "bg-rose-100 text-rose-600", valueTone: "text-rose-600", meta: "Expiry alerts" },
  ];

  return (
    <section className="mb-5 overflow-hidden rounded-[28px] border border-[#c7cbff] bg-white p-2 shadow-[0_22px_50px_rgba(15,23,42,0.1)]">
      <div className="rounded-[22px] bg-[linear-gradient(90deg,#17315c_0%,#224f94_60%,#2d67cb_100%)] px-4 py-3 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
              <FaClipboardList size={15} />
            </span>
            <div className="min-w-0">
              <div className="font-bold text-white text-[20px] leading-[1.2] sm:text-[32px]">Inventory Management</div>
              <div className="inventory-body-text text-blue-100/85">{activeGroupLabel} workspace with live stock overview</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {NAVIGATION_GROUPS.map((group) => {
              const active = group.label === activeGroupLabel;
              return (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => {
                    setOpenNavGroup(group.label);
                    setActiveSection(group.ids[0]);
                  }}
                  className={`rounded-full px-5 py-2.5 text-[14px] font-medium transition ${active ? "bg-white text-slate-950 shadow-[0_10px_30px_rgba(15,23,42,0.2)]" : "bg-white/8 text-blue-100 hover:bg-white/14"}`}
                >
                  {group.label}
                </button>
              );
            })}
           
            
          </div>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-4">
          {overviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.key} className="rounded-[22px] border border-white/10 bg-white/95 p-4 shadow-[0_14px_26px_rgba(15,23,42,0.10)]">
                <div className="flex items-start justify-between gap-3">
                  <span className={`inline-flex h-[70px] w-[70px] items-center justify-center rounded-[24px] ${card.iconTone}`}>
                    <Icon size={30} />
                  </span>
                  <span className="inventory-form-label text-[20px] md:text-[20px] font-semibold uppercase tracking-[0.14em] text-emerald-600">{card.meta}</span>
                </div>
                <div className="inventory-body-text mt-6 text-[20px] md:text-[22px] text-slate-500">{card.label}</div>
                <div className={`mt-4 font-bold leading-none text-[32px] md:text-[40px] ${card.valueTone}`}>{card.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ItemsSection({
  items,
  vendorInwards,
  stockLedgerRows,
  masterData,
  form,
  setForm,
  editingId,
  setEditingId,
  onSave,
  onDelete,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  categories,
}) {
  const ITEMS_LEDGER_PAGE_SIZE = 10;
  const [ledgerPage, setLedgerPage] = useState(1);
  const [stockTab, setStockTab] = useState("list");
  const itemSnapshotMap = useMemo(
    () => new Map(
      (items || []).map((item) => [String(item.name || "").trim().toLowerCase(), item]).filter(([key]) => key),
    ),
    [items],
  );
  const inwardSummaryByItem = useMemo(() => {
    const map = new Map();
    (vendorInwards || []).forEach((row) => {
      const key = String(row.itemName || "").trim().toLowerCase();
      if (!key) return;
      const current = map.get(key);
      const currentDate = current?.receivedDate ? new Date(current.receivedDate) : new Date(0);
      const nextDate = row.receivedDate ? new Date(row.receivedDate) : new Date(0);
      if (!current || nextDate >= currentDate) {
        map.set(key, row);
      }
    });
    return map;
  }, [vendorInwards]);
  const purchaseItemRows = masterData?.["purchase-items"] || [];
  const stockItemOptions = useMemo(
    () => buildSelectOptions([
      ...items.map((item) => item.name),
      ...purchaseItemRows.map((row) => row.itemName),
      ...(vendorInwards || []).map((row) => row.itemName),
    ]),
    [items, purchaseItemRows, vendorInwards],
  );
  const categoryOptions = useMemo(
    () => buildSelectOptions([
      ...categories,
      ...(masterData?.["item-groups"] || []).map((row) => row.name),
      ...(vendorInwards || []).map((row) => row.category),
    ]),
    [categories, masterData, vendorInwards],
  );
  const unitOptions = useMemo(
    () => buildSelectOptions([
      ...(masterData?.units || []).map((row) => row.shortName || row.name),
      ...items.map((item) => item.unit),
      ...purchaseItemRows.map((row) => row.unit),
      ...(vendorInwards || []).map((row) => row.unit),
    ]),
    [items, masterData, purchaseItemRows, vendorInwards],
  );
  const storeOptions = useMemo(
    () => buildSelectOptions([
      ...(masterData?.["store-kitchen"] || []).map((row) => row.name),
      ...items.map((item) => item.branch),
      ...(vendorInwards || []).map((row) => row.store),
    ]),
    [items, masterData, vendorInwards],
  );
  const purchaseMetaByItem = useMemo(() => {
    const map = new Map();
    purchaseItemRows.forEach((row) => {
      const key = String(row.itemName || "").trim().toLowerCase();
      if (!key) return;
      const current = map.get(key);
      const currentDate = current?.sortDate ? new Date(current.sortDate) : new Date(0);
      const nextDate = row.date ? new Date(row.date) : new Date(0);
      if (!current || nextDate >= currentDate) {
        map.set(key, {
          category: row.category || "",
          unit: row.unit || "",
          price: row.ratePerUnit || "",
          vendor: row.vendor || "",
          sortDate: row.date || "",
        });
      }
    });
    return map;
  }, [purchaseItemRows]);
  const stockSummaryByItem = useMemo(() => {
    const map = new Map();
    (stockLedgerRows || []).forEach((row) => {
      const key = String(row.itemName || "").trim().toLowerCase();
      if (!key) return;
      const current = map.get(key) || { receivedQty: 0, usedQty: 0 };
      const quantity = Number(row.quantity || 0);
      const direction = String(row.direction || "").toUpperCase();
      const referenceType = String(row.referenceType || "").toLowerCase();
      if (direction === "IN" && referenceType === "vendor_inward") {
        current.receivedQty += quantity;
      }
      if (direction === "OUT") {
        current.usedQty += quantity;
      }
      map.set(key, current);
    });
    return map;
  }, [stockLedgerRows]);
  const resolvedStockFields = useMemo(() => {
    const baseFields = ITEMS_FORM.map((field) => {
      if (field.key === "name") {
        return {
          ...field,
          type: stockItemOptions.length ? "select" : field.type,
          options: stockItemOptions,
          suggestions: stockItemOptions,
          allowCustom: Boolean(stockItemOptions.length),
          customPlaceholder: "Enter item name",
        };
      }
      if (field.key === "category") {
        return {
          ...field,
          type: categoryOptions.length ? "select" : field.type,
          options: categoryOptions,
          suggestions: categoryOptions,
          allowCustom: Boolean(categoryOptions.length),
          customPlaceholder: "Enter category",
        };
      }
      if (field.key === "unit") {
        return {
          ...field,
          type: unitOptions.length ? "select" : field.type,
          options: unitOptions,
          suggestions: unitOptions,
          allowCustom: Boolean(unitOptions.length),
          customPlaceholder: "Enter unit",
        };
      }
      if (field.key === "branch") {
        return {
          ...field,
          type: storeOptions.length ? "select" : field.type,
          options: storeOptions,
          suggestions: storeOptions,
          allowCustom: Boolean(storeOptions.length),
          customPlaceholder: "Enter store / branch",
        };
      }
      return field;
    });

    if (!editingId) return baseFields;

    return [
      ...baseFields,
      { key: "adjustmentReason", label: "Adjustment Reason", type: "text" },
    ];
  }, [categoryOptions, editingId, stockItemOptions, storeOptions, unitOptions]);

  const handleStockFieldChange = useCallback((key, val) => {
    if (key !== "name") {
      setForm((current) => ({ ...current, [key]: val }));
      return;
    }

    const normalizedKey = String(val || "").trim().toLowerCase();
    const itemSnapshot = itemSnapshotMap.get(normalizedKey);
    const inwardSummary = inwardSummaryByItem.get(normalizedKey);
    const purchaseMeta = purchaseMetaByItem.get(normalizedKey);

    setForm((current) => ({
      ...current,
      name: val,
      category: itemSnapshot?.category || purchaseMeta?.category || current.category || "",
      stock: itemSnapshot ? itemSnapshot.stock ?? "" : current.stock || "",
      unit: itemSnapshot?.unit || inwardSummary?.unit || purchaseMeta?.unit || current.unit || "",
      price: itemSnapshot?.price || purchaseMeta?.price || current.price || "",
      reorderPoint: itemSnapshot?.reorderPoint || current.reorderPoint || "",
      expiry: itemSnapshot?.expiry || inwardSummary?.expiryDate || current.expiry || "",
      branch: itemSnapshot?.branch || inwardSummary?.store || current.branch || "",
    }));
  }, [inwardSummaryByItem, itemSnapshotMap, purchaseMetaByItem, setForm]);

  const visibleItems = items.filter((item) => {
    const matchCat = categoryFilter === "All" || item.category === categoryFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = [item.name, item.category, item.branch].some(
      (v) => String(v || "").toLowerCase().includes(q)
    );
    return matchCat && matchSearch;
  });

  const totalLedgerPages = Math.max(1, Math.ceil(visibleItems.length / ITEMS_LEDGER_PAGE_SIZE));
  const paginatedItems = visibleItems.slice(
    (ledgerPage - 1) * ITEMS_LEDGER_PAGE_SIZE,
    ledgerPage * ITEMS_LEDGER_PAGE_SIZE,
  );

  useEffect(() => {
    setLedgerPage(1);
  }, [searchQuery, categoryFilter, items]);

  useEffect(() => {
    if (ledgerPage > totalLedgerPages) {
      setLedgerPage(totalLedgerPages);
    }
  }, [ledgerPage, totalLedgerPages]);

  useEffect(() => {
    if (editingId) {
      setStockTab("add");
    }
  }, [editingId]);

  const resetStockForm = () => {
    setForm({ ...buildInitialForm(ITEMS_FORM), adjustmentReason: "" });
    setEditingId(null);
    setStockTab("list");
  };

  const handleSaveStock = async () => {
    const saved = await onSave();
    if (saved) {
      setStockTab("list");
    }
  };

  const handleEditStock = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      category: item.category || "",
      stock: item.stock || "",
      unit: item.unit || "",
      price: item.price || "",
      reorderPoint: item.reorderPoint || "",
      expiry: item.expiry ? String(item.expiry).split("T")[0] : "",
      branch: item.branch || "",
      adjustmentReason: "",
    });
    setStockTab("add");
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
          {[
            { id: "list", label: "Stock List", helper: "Current stock table and records" },
            {
              id: "add",
              label: editingId ? "Edit Stock" : "Add Stock",
              helper: editingId ? "Update the selected stock item" : "Open form to add new stock",
            },
          ].map((tab) => {
            const active = stockTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStockTab(tab.id)}
                className={`inline-flex min-h-[52px] items-center gap-3 rounded-full border px-5 py-3 text-left transition ${
                  active
                    ? "border-transparent bg-[linear-gradient(90deg,#1d4ed8_0%,#2563eb_100%)] text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)]"
                    : "border-slate-200 bg-slate-100/80 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                  active ? "bg-white/15 text-white" : "bg-white text-slate-500"
                }`}>
                  {tab.id === "list" ? <FaWarehouse size={12} /> : <FaPlus size={11} />}
                </span>
                <div className={`text-[16px] font-bold ${active ? "text-white" : "text-slate-700"}`}>
                  {tab.label}
                </div>
              </button>
            );
          })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex min-w-[240px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <FaSearch size={12} className="text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="w-full bg-transparent outline-none placeholder:text-[15px] placeholder:text-slate-400"
              />
            </label>
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <FaFilter size={12} className="text-slate-400" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-transparent outline-none">
                <option value="All">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-1">
        {stockTab === "add" ? (
        <FormPanel
          title="Stock Item"
          subtitle="Use this tab to add or update inventory stock"
          fields={resolvedStockFields}
          draft={form}
          setDraft={setForm}
          editingId={editingId}
          onSave={handleSaveStock}
          onReset={resetStockForm}
          onFieldChange={handleStockFieldChange}
        />
        ) : null}

        {stockTab === "list" ? (
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[20px] font-semibold text-slate-900">Items Ledger</h3>
              <p className="text-[16px] text-slate-400">{items.length} total items loaded from backend</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white">
            <table className="min-w-full text-[15px]">
              <thead className="bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Last Vendor</th>
                  <th className="px-4 py-3">Received Qty</th>
                  <th className="px-4 py-3">Used Qty</th>
                  <th className="px-4 py-3">Physical Stock</th>
                  <th className="px-4 py-3">Reorder Level</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length ? paginatedItems.map((item) => {
                  const low = isLowStock(item);
                  const normalizedItemKey = String(item.name || "").trim().toLowerCase();
                  const inwardSummary = inwardSummaryByItem.get(normalizedItemKey);
                  const purchaseMeta = purchaseMetaByItem.get(normalizedItemKey);
                  const stockSummary = stockSummaryByItem.get(normalizedItemKey) || { receivedQty: 0, usedQty: 0 };
                  const effectiveExpiry = inwardSummary?.expiryDate || item.expiry;
                  const lastVendorName = inwardSummary?.vendorName || purchaseMeta?.vendor || "—";
                  const expStatus = getExpiryStatus(effectiveExpiry);
                  return (
                    <tr key={item.id} className={`border-t border-slate-100 hover:bg-cyan-50/40 transition ${low ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-semibold text-slate-900">{item.name}</span>
                          {low && <FaExclamationTriangle className="text-amber-500" size={11} title="Low stock" />}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-lg text-slate-600">{item.category}</td>
                      <td className="px-4 py-4 text-base text-slate-600">{lastVendorName}</td>
                      <td className="px-4 py-4 text-base text-slate-500">{stockSummary.receivedQty} {item.unit}</td>
                      <td className="px-4 py-4 text-base text-slate-500">{stockSummary.usedQty} {item.unit}</td>
                      <td className="px-4 py-4">
                        <span className={`text-lg font-semibold ${low ? "text-amber-600" : "text-slate-900"}`}>
                          {item.stock} <span className="text-base font-normal text-slate-400">{item.unit}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-base text-slate-500">{item.reorderPoint || 10} {item.unit}</td>
                      <td className="px-4 py-4 text-lg text-slate-700">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-4">
                        {expStatus
                          ? <span className={`inline-block rounded-full border px-3 py-1.5 text-base font-semibold ${expStatus.color}`}>{expStatus.label}</span>
                          : item.expiry ? <span className="text-base text-slate-400">{String(item.expiry).split("T")[0]}</span> : <span className="text-base text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-lg text-slate-600">{item.branch}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEditStock(item)}
                            className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-base font-semibold text-cyan-700 transition hover:bg-cyan-100">
                            <FaEdit size={10} /> Edit
                          </button>
                          <button type="button" onClick={() => onDelete(item.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-base font-semibold text-red-600 transition hover:bg-red-100">
                            <FaTrash size={10} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-lg text-slate-400">No matching inventory items.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {visibleItems.length > ITEMS_LEDGER_PAGE_SIZE ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-900">
                  {(ledgerPage - 1) * ITEMS_LEDGER_PAGE_SIZE + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-900">
                  {Math.min(ledgerPage * ITEMS_LEDGER_PAGE_SIZE, visibleItems.length)}
                </span>{" "}
                of <span className="font-semibold text-slate-900">{visibleItems.length}</span> items
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerPage((current) => Math.max(1, current - 1))}
                  disabled={ledgerPage === 1}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                {Array.from({ length: totalLedgerPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setLedgerPage(pageNumber)}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                      pageNumber === ledgerPage
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setLedgerPage((current) => Math.min(totalLedgerPages, current + 1))}
                  disabled={ledgerPage === totalLedgerPages}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Section: Generic Master ──────────────────────────────────────────────────

function GenericMasterSection({ section, records, onSave, onEdit, onDelete, draft, setDraft, editingId, searchQuery, setSearchQuery, setActiveSection, vendorInsights, masterData, vendorInwards = [] }) {
  const fields = MASTER_FIELDS[section.id];
  const columns = MASTER_TABLE_COLUMNS[section.id];
  const [workspaceView, setWorkspaceView] = useState("add");
  const isPurchaseServicesSection = section.id === "purchase-services";
  const isPurchaseItemsSection = section.id === "purchase-items";
  const isSegmentsSection = section.id === "segments";
  const isUnitsSection = section.id === "units";
  const isStoreKitchenSection = section.id === "store-kitchen";
  const isItemGroupsSection = section.id === "item-groups";
  const subtitle = API_BACKED_MASTER_SECTIONS.has(section.id)
    ? "Synced with inventory backend API"
    : "Stored in local inventory workspace";
  const filtered = records.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const vendorSummary = vendorInsights?.summary || {};
  const vendorStats = vendorInsights?.vendors || [];

  const handleSave = async () => {
    const saved = await onSave();
    if (saved) {
      setWorkspaceView("list");
    }
  };

  const handleReset = () => {
    setDraft(buildInitialForm(fields));
    onEdit(null);
    setWorkspaceView("list");
  };

  const handleEdit = (record) => {
    onEdit(record);
    setWorkspaceView("add");
  };

  useEffect(() => {
    setWorkspaceView("add");
  }, [section.id]);

  useEffect(() => {
    if (editingId) {
      setWorkspaceView("add");
    }
  }, [editingId]);

  useEffect(() => {
    if (!isPurchaseItemsSection) return;
    const quantity = Number(draft.quantity || 0);
    const ratePerUnit = Number(draft.ratePerUnit || 0);
    const nextAmount = quantity > 0 && ratePerUnit > 0 ? quantity * ratePerUnit : 0;
    const currentAmount = Number(draft.amount || 0);
    if (currentAmount === nextAmount) return;
    setDraft((current) => ({
      ...current,
      amount: nextAmount ? String(nextAmount) : "",
    }));
  }, [draft.quantity, draft.ratePerUnit, draft.amount, isPurchaseItemsSection, setDraft]);

  useEffect(() => {
    if (!isPurchaseItemsSection || editingId) return;
    if (String(draft.invoiceNo || "").trim()) return;
    setDraft((current) => ({
      ...current,
      invoiceNo: generatePurchaseInvoiceNo(),
    }));
  }, [draft.invoiceNo, editingId, isPurchaseItemsSection, setDraft]);

  const vendorOptions = (masterData?.vendors || [])
    .map((row) => String(row.name || "").trim())
    .filter(Boolean);

  const unitOptions = (masterData?.units || [])
    .map((row) => String(row.shortName || row.name || "").trim())
    .filter(Boolean);

  const unitNameOptions = buildSelectOptions([
    ...UNIT_PRESETS.map((preset) => preset.name),
    ...(masterData?.units || []).map((row) => row.name),
    ...records.map((row) => row.name),
  ]);

  const unitShortNameOptions = buildSelectOptions([
    ...UNIT_PRESETS.map((preset) => preset.shortName),
    ...(masterData?.units || []).map((row) => row.shortName),
    ...records.map((row) => row.shortName),
  ]);

  const unitTypeOptions = buildSelectOptions([
    "Weight",
    "Volume",
    "Count",
    ...(masterData?.units || []).map((row) => row.type),
    ...records.map((row) => row.type),
  ]);

  const itemOptions = buildSelectOptions([
    ...(masterData?.["purchase-items"] || []).map((row) => row.itemName),
    ...DEFAULT_MASTER_DATA["purchase-items"].map((row) => row.itemName),
  ]);
  const selectedPurchaseVendor = String(draft.vendor || "").trim();
  const purchaseVendorHistory = [
    ...(masterData?.["purchase-items"] || []),
    ...DEFAULT_MASTER_DATA["purchase-items"],
    ...(vendorInsights?.vendors || []).flatMap(() => []),
  ];
  const vendorInwardHistory = Array.isArray(vendorInwards) ? vendorInwards : [];
  const vendorScopedItemRows = [
    ...purchaseVendorHistory
      .filter((row) => !selectedPurchaseVendor || String(row.vendor || "").trim() === selectedPurchaseVendor)
      .map((row) => ({
        itemName: row.itemName,
        unit: row.unit,
        ratePerUnit: row.ratePerUnit,
      })),
    ...vendorInwardHistory
      .filter((row) => !selectedPurchaseVendor || String(row.vendorName || "").trim() === selectedPurchaseVendor)
      .map((row) => ({
        itemName: row.itemName,
        unit: row.unit,
        ratePerUnit: row.rate,
      })),
  ];
  const vendorScopedItemOptions = buildSelectOptions(vendorScopedItemRows.map((row) => row.itemName));
  const vendorItemMetaMap = vendorScopedItemRows.reduce((map, row) => {
    const key = String(row.itemName || "").trim().toLowerCase();
    if (!key || map.has(key)) return map;
    map.set(key, row);
    return map;
  }, new Map());

  const storeOptions = buildSelectOptions((masterData?.["store-kitchen"] || []).map((row) => row.name));
  const detectedManagerName = String(localStorage.getItem("name") || "").trim();
  const managerOptions = buildSelectOptions([
    detectedManagerName,
    ...(masterData?.["store-kitchen"] || []).map((row) => row.manager),
    ...records.map((row) => row.manager),
  ]);
  const segmentNameOptions = buildSelectOptions([
    ...SEGMENT_PRESETS.map((preset) => preset.name),
    ...(masterData?.segments || []).map((row) => row.name),
    ...records.map((row) => row.name),
  ]);
  const selectedSegment = String(draft.segment || "").trim();
  const presetItemGroupOptions = selectedSegment
    ? ITEM_GROUP_PRESETS[selectedSegment] || []
    : Object.values(ITEM_GROUP_PRESETS).flat();
  const itemGroupNameOptions = buildSelectOptions([
    ...presetItemGroupOptions,
    ...(masterData?.["item-groups"] || [])
      .filter((row) => !selectedSegment || String(row.segment || "").trim() === selectedSegment)
      .map((row) => row.name),
    ...records
      .filter((row) => !selectedSegment || String(row.segment || "").trim() === selectedSegment)
      .map((row) => row.name),
  ]);

  const resolvedFields = fields.map((field) => {
    if (isItemGroupsSection && field.key === "name") {
      return {
        ...field,
        type: "select",
        options: itemGroupNameOptions,
        allowCustom: true,
        customPlaceholder: "Enter custom item group",
      };
    }
    if (isItemGroupsSection && field.key === "segment") {
      return {
        ...field,
        type: "select",
        options: segmentNameOptions,
        allowCustom: true,
        customPlaceholder: "Enter custom segment",
      };
    }
    if (isSegmentsSection && field.key === "name") {
      return {
        ...field,
        type: "select",
        options: segmentNameOptions,
        allowCustom: true,
        customPlaceholder: "Enter custom segment name",
      };
    }
    if (isUnitsSection && field.key === "name") {
      return {
        ...field,
        type: "select",
        options: unitNameOptions,
        allowCustom: true,
        customPlaceholder: "Enter custom unit name",
      };
    }
    if (isUnitsSection && field.key === "shortName") {
      return {
        ...field,
        type: "select",
        options: unitShortNameOptions,
        allowCustom: true,
        customPlaceholder: "Enter custom short name",
      };
    }
    if (isUnitsSection && field.key === "type") {
      return {
        ...field,
        type: "select",
        options: unitTypeOptions,
      };
    }
    if ((isPurchaseItemsSection || section.id === "purchase-services") && field.key === "vendor") {
      return { ...field, type: vendorOptions.length ? "select" : field.type, options: vendorOptions };
    }
    if (isPurchaseItemsSection && field.key === "unit") {
      return {
        ...field,
        type: unitOptions.length ? "select" : field.type,
        options: unitOptions,
        suggestions: unitOptions,
      };
    }
    if (isPurchaseItemsSection && field.key === "itemName") {
      return {
        ...field,
        type: vendorScopedItemOptions.length ? "select" : "text",
        options: vendorScopedItemOptions,
        suggestions: vendorScopedItemOptions,
        allowCustom: Boolean(vendorScopedItemOptions.length),
        customPlaceholder: "Enter custom item name",
      };
    }
    if (section.id === "stock-transfer" && field.key === "itemName") {
      return {
        ...field,
        type: itemOptions.length ? "select" : field.type,
        options: itemOptions,
        suggestions: itemOptions,
      };
    }
    if (section.id === "stock-transfer" && (field.key === "fromStore" || field.key === "toStore")) {
      return {
        ...field,
        type: storeOptions.length ? "select" : field.type,
        options: storeOptions,
        suggestions: storeOptions,
      };
    }
    if (section.id === "stock-transfer" && field.key === "unit") {
      return {
        ...field,
        type: unitOptions.length ? "select" : field.type,
        options: unitOptions,
        suggestions: unitOptions,
      };
    }
    if (isStoreKitchenSection && field.key === "manager") {
      return {
        ...field,
        type: managerOptions.length ? "select" : "text",
        options: managerOptions,
        suggestions: managerOptions,
        allowCustom: Boolean(managerOptions.length),
        customPlaceholder: "Enter manager name",
      };
    }
    return field;
  });

  const handleFieldChange = useCallback((key, val) => {
    if (isPurchaseItemsSection && key === "vendor") {
      setDraft((current) => ({
        ...current,
        vendor: val,
        itemName: String(current.vendor || "").trim() === String(val || "").trim() ? current.itemName : "",
        unit: String(current.vendor || "").trim() === String(val || "").trim() ? current.unit : "",
        ratePerUnit: String(current.vendor || "").trim() === String(val || "").trim() ? current.ratePerUnit : "",
      }));
      return;
    }

    if (isPurchaseItemsSection && key === "itemName") {
      const meta = vendorItemMetaMap.get(String(val || "").trim().toLowerCase());
      setDraft((current) => ({
        ...current,
        itemName: val,
        unit: meta?.unit || current.unit || "",
        ratePerUnit: meta?.ratePerUnit || current.ratePerUnit || "",
      }));
      return;
    }

    if (isItemGroupsSection && key === "segment") {
      setDraft((current) => ({
        ...current,
        segment: val,
        name:
          String(current.segment || "").trim() === String(val || "").trim()
            ? current.name
            : "",
      }));
      return;
    }

    if (isSegmentsSection && key === "name") {
      const preset = findSegmentPreset(val);
      setDraft((current) => ({
        ...current,
        name: val,
        description: preset?.description || current.description || "",
      }));
      return;
    }

    if (!isUnitsSection) {
      setDraft((current) => ({ ...current, [key]: val }));
      return;
    }

    if (key === "name") {
      const preset = findUnitPreset(val, "name");
      setDraft((current) => ({
        ...current,
        name: val,
        shortName: preset?.shortName || current.shortName || "",
        type: preset?.type || current.type || "",
      }));
      return;
    }

    if (key === "shortName") {
      const preset = findUnitPreset(val, "shortName");
      setDraft((current) => ({
        ...current,
        shortName: val,
        name: preset?.name || current.name || "",
        type: preset?.type || current.type || "",
      }));
      return;
    }

    setDraft((current) => ({ ...current, [key]: val }));
  }, [isItemGroupsSection, isPurchaseItemsSection, isSegmentsSection, isUnitsSection, setDraft, vendorItemMetaMap]);

  useEffect(() => {
    if (!isStoreKitchenSection || editingId) return;
    if (String(draft.manager || "").trim()) return;
    if (!detectedManagerName) return;

    setDraft((current) => {
      if (String(current.manager || "").trim()) return current;
      return { ...current, manager: detectedManagerName };
    });
  }, [detectedManagerName, draft.manager, editingId, isStoreKitchenSection, setDraft]);

  const statCards = section.id === "vendors" ? [
    {
      label: "Registered Vendors",
      value: vendorSummary.totalVendors || records.length,
      iconTone: "bg-violet-100 text-violet-600",
      icon: FaTruck,
    },
    {
      label: "Stock Received",
      value: `${Number(vendorSummary.totalReceivedQty || 0).toFixed(2).replace(/\.00$/, "")} units`,
      iconTone: "bg-blue-100 text-blue-600",
      icon: FaBoxes,
    },
    {
      label: "Received Value",
      value: formatCurrency(vendorSummary.totalReceivedValue || 0),
      iconTone: "bg-emerald-100 text-emerald-600",
      icon: FaClipboardList,
    },
    {
      label: "Outstanding",
      value: formatCurrency(vendorSummary.totalOutstandingAmount || 0),
      iconTone: "bg-amber-100 text-amber-600",
      icon: FaChartBar,
    },
  ] : [
    {
      label: section.id === "menu-categories" ? "Total Menu Items" : `${section.label} Records`,
      value: records.length,
      iconTone: "bg-violet-100 text-violet-600",
      icon: FaLayerGroup,
    },
    {
      label: "Active Records",
      value: records.filter((row) => String(row.status || "").toLowerCase().includes("active")).length,
      iconTone: "bg-blue-100 text-blue-600",
      icon: FaTruck,
    },
    {
      label: "Fields Tracked",
      value: columns.length,
      iconTone: "bg-emerald-100 text-emerald-600",
      icon: FaClipboardList,
    },
    {
      label: "Search Results",
      value: filtered.length,
      iconTone: "bg-violet-100 text-violet-500",
      icon: FaStore,
    },
  ];
  const orderedSectionFields =
    section.id === "stock-transfer"
      ? [
          "itemName",
          "toStore",
          "fromStore",
          "quantity",
          "unit",
          "approvedBy",
          "notes",
          "date",
        ]
          .map((key) => resolvedFields.find((field) => field.key === key))
          .filter(Boolean)
      : section.id === "vendors"
      ? ["name", "contact", "phone", "email", "city", "gstin", "status"]
          .map((key) => resolvedFields.find((field) => field.key === key))
          .filter(Boolean)
      : section.id === "store-kitchen"
      ? ["name", "type", "manager", "status"]
          .map((key) => resolvedFields.find((field) => field.key === key))
          .filter(Boolean)
      : section.id === "ingredients"
      ? ["name", "group", "unit", "status"]
          .map((key) => resolvedFields.find((field) => field.key === key))
          .filter(Boolean)
      : section.id === "purchase-items"
      ? ["itemName", "vendor", "quantity", "unit", "ratePerUnit", "amount", "invoiceNo", "date"]
          .map((key) => resolvedFields.find((field) => field.key === key))
          .filter(Boolean)
      : section.id === "purchase-services"
      ? ["serviceName", "vendor", "amount", "date", "status"]
          .map((key) => resolvedFields.find((field) => field.key === key))
          .filter(Boolean)
      : resolvedFields;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-[24px] border border-white/70 bg-white/95 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[16px] font-semibold text-slate-700">{card.label}</div>
                  <div className="mt-1 text-3xl font-bold text-slate-950">{card.value}</div>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${card.iconTone}`}>
                  <Icon size={14} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {section.id === "vendors" && vendorStats.length ? (
        <div className="rounded-[26px] border border-white/70 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Vendor Supply Snapshot</h3>
              <p className="text-sm text-slate-400">Real inward and payment data across vendors</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-4">Vendor</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Receipts</th>
                  <th className="px-4 py-4">Qty Received</th>
                  <th className="px-4 py-4">Supply Value</th>
                  <th className="px-4 py-4">Paid</th>
                  <th className="px-4 py-4">Due</th>
                  <th className="px-4 py-4">Last Received</th>
                </tr>
              </thead>
              <tbody>
                {vendorStats.slice(0, 8).map((row) => (
                  <tr key={row.vendorName} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">{row.vendorName}</td>
                    <td className="px-4 py-4"><Badge color={String(row.status || "").toLowerCase().includes("hold") ? "amber" : "green"}>{row.status || "Active"}</Badge></td>
                    <td className="px-4 py-4 text-slate-700">{row.receiptsCount}</td>
                    <td className="px-4 py-4 text-slate-700">{Number(row.totalQty || 0).toFixed(2).replace(/\.00$/, "")}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(row.totalValue || 0)}</td>
                    <td className="px-4 py-4 text-emerald-600 font-semibold">{formatCurrency(row.totalPaid || 0)}</td>
                    <td className="px-4 py-4 text-amber-600 font-semibold">{formatCurrency(row.totalDue || 0)}</td>
                    <td className="px-4 py-4 text-slate-500">{row.lastReceivedDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {[
          {
            id: "add",
            label: isPurchaseServicesSection
              ? (editingId ? "Edit Purchase Services" : "Add Purchase Services")
              : (editingId ? `Edit ${section.label}` : `Add ${section.label}`),
            icon: FaPlus,
          },
          {
            id: "list",
            label: isPurchaseServicesSection ? "Purchase Services List" : `${section.label} List`,
            icon: FaListAlt,
          },
        ].map((view) => {
          const active = workspaceView === view.id;
          const Icon = view.icon;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => setWorkspaceView(view.id)}
              className={`inline-flex min-h-[50px] items-center gap-2.5 rounded-full border px-5 py-3 text-[16px] font-semibold transition ${
                active
                  ? "border-transparent bg-[linear-gradient(90deg,#7c3aed_0%,#6d28d9_100%)] text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Icon size={13} />
              {view.label}
            </button>
          );
        })}
      </div>

      <div className={`grid gap-5 ${workspaceView === "add" ? (isPurchaseServicesSection ? "" : "xl:grid-cols-[320px,minmax(0,1fr)]") : ""}`}>
        {workspaceView === "add" ? (
        <div className={`space-y-4 ${isPurchaseServicesSection ? "" : ""}`}>
          <div className="rounded-[26px] border border-white/70 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <span className="inline-flex h-5 w-1.5 rounded-full bg-violet-500" />
              <h3 className="text-xl font-bold">
                {isPurchaseServicesSection
                  ? (editingId ? "Edit Purchase Services" : "Add New Purchase Services")
                  : (editingId ? `Edit ${section.label}` : `Add New ${section.label}`)}
              </h3>
            </div>
            <div className={`grid gap-3 ${
              section.id === "stock-transfer" || section.id === "vendors" || section.id === "store-kitchen"
                || section.id === "ingredients" || section.id === "purchase-items" || section.id === "purchase-services"
                ? "sm:grid-cols-2"
                : ""
            } ${isPurchaseServicesSection ? "" : "space-y-0"}`}>
              {orderedSectionFields.map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {field.label} {field.required ? <span className="text-red-400">*</span> : null}
                  </label>
                  <FormInput
                    field={field}
                    value={draft[field.key] ?? ""}
                    onChange={handleFieldChange}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex h-[44px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#7c3aed_0%,#6d28d9_100%)] px-7 text-[16px] font-semibold text-white shadow-[0_18px_28px_rgba(109,40,217,0.28)] [text-shadow:0_1px_0_rgba(15,23,42,0.18)]"
              >
                <FaPlus size={11} />
                {isPurchaseServicesSection
                  ? (editingId ? "Save Purchase Services" : "Save Purchase Services")
                  : (editingId ? `Update ${section.label}` : `Save ${section.label}`)}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] bg-[linear-gradient(135deg,#4f1ecf_0%,#7c3aed_55%,#6d28d9_100%)] p-5 text-white shadow-[0_20px_40px_rgba(109,40,217,0.28)]">
            <div className="text-xl font-bold">Smart Organization</div>
            <p className="mt-3 text-sm leading-6 text-white/85">
              {isUnitsSection
                ? "Choose a preset unit name or short name to auto-fill the matching type. You can still enter a custom unit manually if needed."
                : "System-wide updates propagate instantly. Changes to master units reflect in real-time stock calculations."}
            </p>
          </div>
        </div>
        ) : null}

        {workspaceView === "list" ? (
        <div className="rounded-[26px] border border-white/70 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Existing {section.label}</h3>
              <p className="text-sm text-slate-400">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-64">
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={`Search ${section.label.toLowerCase()}...`} />
              </div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                <FaFilter size={12} />
              </span>
            </div>
          </div>
          <DataTable columns={columns} rows={filtered} onEdit={handleEdit} onDelete={onDelete} emptyMessage="No matching records found." />
        </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Section: Purchase Orders (PO / GRN) ─────────────────────────────────────

function MenuItemsSection({ records, draft, setDraft, editingId, onSave, onEdit, onDelete, searchQuery, setSearchQuery, menuCategoryOptions }) {
  const MENU_LIBRARY_PAGE_SIZE = 8;
  const [activeTab, setActiveTab] = useState("form");
  const filtered = records.filter((record) =>
    Object.values(record).some((value) => String(value ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const [menuPages, setMenuPages] = useState({});
  const previewImage = useMemo(() => {
    if (draft.imageFile instanceof File) {
      return URL.createObjectURL(draft.imageFile);
    }
    return resolveAssetUrl(draft.imageUrl);
  }, [draft.imageFile, draft.imageUrl]);

  useEffect(() => {
    if (!previewImage || !(draft.imageFile instanceof File)) return undefined;
    return () => URL.revokeObjectURL(previewImage);
  }, [draft.imageFile, previewImage]);

  useEffect(() => {
    setMenuPages({});
  }, [records, searchQuery]);

  useEffect(() => {
    if (editingId) {
      setActiveTab("form");
    }
  }, [editingId]);

  const handleSave = async () => {
    const saved = await onSave();
    if (saved) {
      setActiveTab("list");
    }
  };

  const handleReset = () => {
    setDraft(buildInitialForm(MENU_ITEM_FIELDS));
    onEdit(null);
    setActiveTab("list");
  };

  const handleEdit = (record) => {
    onEdit(record);
    setActiveTab("form");
  };

  const grouped = filtered.reduce((acc, item) => {
    const key = item.category || "Uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <SectionTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        segmented
        listIcon={FaUtensils}
        formIcon={FaPlus}
        listLabel="Menu"
        listHelper="Browse saved menu cards"
        formLabel="Add Menu Item"
        formHelper={editingId ? "Update the selected dish card" : "Open form to create a new menu item"}
      />
      {activeTab === "form" ? (
        <div className="space-y-5">
          <FormPanel
            title="Menu Item"
            subtitle="Manage category-wise dish cards from the inventory module."
            fields={MENU_ITEM_FIELDS.map((field) =>
              field.key === "category"
                ? {
                    ...field,
                    type: "select",
                    options: Array.from(
                      new Set(
                        [
                          ...menuCategoryOptions,
                          String(draft.category || "").trim(),
                        ].filter(Boolean),
                      ),
                    ).sort((a, b) => a.localeCompare(b)),
                  }
                : field
            )}
            draft={draft}
            setDraft={setDraft}
            editingId={editingId}
            onSave={handleSave}
            onReset={handleReset}
          />
          {previewImage ? (
            <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.10)]">
              <div className="relative h-52 overflow-hidden bg-slate-100 sm:h-56">
                <img
                  src={previewImage}
                  alt={draft.name || "Menu preview"}
                  className="block h-full w-full object-cover object-center"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/40 via-slate-950/10 to-transparent" />
                <div className="absolute left-3 top-3">
                  <Badge color="cyan">{draft.category || "Menu item"}</Badge>
                </div>
                <div className="absolute right-3 top-3">
                  <Badge color={String(draft.status || "").toLowerCase().includes("out") ? "red" : "green"}>
                    {draft.status || "Available"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3 bg-gradient-to-b from-white to-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-slate-900">{draft.name || "Dish image preview"}</div>
                    <div className="mt-1 min-h-[40px] text-sm leading-5 text-slate-500">
                      {draft.description || (draft.imageFile instanceof File ? "Selected image upload ke saath save hogi." : "Saved image preview.")}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={String(draft.foodType || "").toLowerCase().includes("non") ? "red" : "green"}>
                    {draft.foodType || "Veg"}
                  </Badge>
                  <Badge color="amber">{formatCurrency(draft.price || 0)}</Badge>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "list" ? (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-3xl font-semibold text-slate-900">Menu card library</h3>
                <p className="text-xl text-slate-400">{records.length} dishes ready to manage</p>
              </div>
              <div className="w-80">
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search dish / category / food type" />
              </div>
            </div>
          </div>

          {Object.keys(grouped).length ? Object.entries(grouped).map(([category, items]) => {
            const currentPage = menuPages[category] || 1;
            const totalPages = Math.max(1, Math.ceil(items.length / MENU_LIBRARY_PAGE_SIZE));
            const paginatedItems = items.slice(
              (currentPage - 1) * MENU_LIBRARY_PAGE_SIZE,
              currentPage * MENU_LIBRARY_PAGE_SIZE,
            );

            return (
              <div key={category} className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-500">Category</div>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-900">{category}</h3>
                  </div>
                  <Badge color="cyan">{items.length} items</Badge>
                </div>

                <div className="overflow-hidden rounded-[22px] border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-left text-lg">
                      <thead className="bg-slate-50 text-sm uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-4 py-4">Image</th>
                          <th className="px-4 py-4">Item</th>
                          <th className="px-4 py-4">Category</th>
                          <th className="px-4 py-4">Food Type</th>
                          <th className="px-4 py-4">Price</th>
                          <th className="px-4 py-4">Status</th>
                          <th className="px-4 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item) => (
                          <tr key={item.id} className="border-t border-slate-200 align-top">
                            <td className="px-4 py-4">
                              <div className="flex justify-center">
                                {item.imageUrl ? (
                                  <img
                                    src={resolveAssetUrl(item.imageUrl)}
                                    alt={item.name}
                                    className="h-20 w-20 rounded-2xl border border-slate-200 object-cover object-center shadow-sm"
                                  />
                                ) : (
                                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-cyan-200 bg-[linear-gradient(135deg,#dbeafe_0%,#f8fafc_100%)] text-base font-semibold text-slate-400">
                                    No Image
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-xl font-bold text-slate-900">{item.name}</div>
                              <div className="mt-1 max-w-[320px] text-base leading-6 text-slate-500">
                                {item.description || "No description added yet."}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-slate-700">{item.category || "Menu item"}</td>
                            <td className="px-4 py-4">
                              <Badge color={String(item.foodType || "").toLowerCase().includes("non") ? "red" : "green"}>
                                {item.foodType || "Veg"}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-4">
                              <Badge color={String(item.status || "").toLowerCase().includes("out") ? "red" : "green"}>
                                {item.status || "Available"}
                              </Badge>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-center gap-2">
                                <button type="button" onClick={() => handleEdit(item)}
                                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-base font-semibold text-cyan-700 hover:bg-cyan-100 transition">
                                  <FaEdit size={10} /> Edit
                                </button>
                                <button type="button" onClick={() => onDelete(item.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-base font-semibold text-red-600 hover:bg-red-100 transition">
                                  <FaTrash size={10} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {items.length > MENU_LIBRARY_PAGE_SIZE ? (
                    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xl text-slate-500">
                        Showing{" "}
                        <span className="font-semibold text-slate-900">
                          {(currentPage - 1) * MENU_LIBRARY_PAGE_SIZE + 1}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold text-slate-900">
                          {Math.min(currentPage * MENU_LIBRARY_PAGE_SIZE, items.length)}
                        </span>{" "}
                        of <span className="font-semibold text-slate-900">{items.length}</span> items
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setMenuPages((current) => ({
                              ...current,
                              [category]: Math.max(1, (current[category] || 1) - 1),
                            }))
                          }
                          disabled={currentPage === 1}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>

                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() =>
                              setMenuPages((current) => ({
                                ...current,
                                [category]: pageNumber,
                              }))
                            }
                            className={`rounded-full px-4 py-2.5 text-base font-semibold transition ${
                              pageNumber === currentPage
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setMenuPages((current) => ({
                              ...current,
                              [category]: Math.min(totalPages, (current[category] || 1) + 1),
                            }))
                          }
                          disabled={currentPage === totalPages}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          }) : (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center text-sm text-slate-500 shadow-[0_24px_60px_rgba(15,23,42,0.07)]">
              No menu items yet. Left side form se first dish save karo.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PurchaseOrderSection({
  records,
  onSave,
  onEdit,
  onDelete,
  draft,
  setDraft,
  editingId,
  searchQuery,
  setSearchQuery,
  inventoryItems,
  vendorInwards,
  refreshVendorInwards,
  vendorPayments,
  refreshVendorPayments,
  stockLedgerRows,
  refreshStockLedger,
  vendorInsights,
  refreshInventoryItems,
  refreshPurchaseOrders,
  masterData,
  procurementOnly = false,
}) {
  const [activeTab, setActiveTab] = useState("form");
  const [opsTab, setOpsTab] = useState("inward-form");
  const [opsSearch, setOpsSearch] = useState("");
  const [inwardDraft, setInwardDraft] = useState(() => buildInitialForm([
    { key: "poNumber", label: "PO Number", type: "text" },
    { key: "vendorName", label: "Vendor", type: "text", required: true },
    { key: "itemName", label: "Item Name", type: "text", required: true },
    { key: "quantityReceived", label: "Quantity Received", type: "number", required: true },
    { key: "unit", label: "Unit", type: "text" },
    { key: "rate", label: "Rate / Unit (₹)", type: "number" },
    { key: "amount", label: "Amount (₹)", type: "number" },
    { key: "invoiceNo", label: "Invoice No", type: "text" },
    { key: "batchNo", label: "Batch No", type: "text" },
    { key: "expiryDate", label: "Expiry Date", type: "date" },
    { key: "receivedDate", label: "Received Date", type: "date", required: true },
    { key: "store", label: "Store", type: "text" },
    { key: "remarks", label: "Remarks", type: "text" },
  ]));
  const [paymentDraft, setPaymentDraft] = useState(() => buildInitialForm([
    { key: "vendorName", label: "Vendor", type: "text", required: true },
    { key: "invoiceRef", label: "Invoice Ref", type: "text" },
    { key: "paymentDate", label: "Payment Date", type: "date", required: true },
    { key: "amount", label: "Amount (₹)", type: "number", required: true },
    { key: "paymentMode", label: "Payment Mode", type: "select", options: ["Bank Transfer", "Cash", "UPI", "Cheque"] },
    { key: "status", label: "Status", type: "select", options: ["Scheduled", "Paid", "Partial", "Cancelled"] },
    { key: "notes", label: "Notes", type: "text" },
  ]));
  const [editingInwardId, setEditingInwardId] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const filtered = records.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredInwards = vendorInwards.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(opsSearch.toLowerCase()))
  );
  const filteredPayments = vendorPayments.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(opsSearch.toLowerCase()))
  );
  const filteredLedger = stockLedgerRows.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(opsSearch.toLowerCase()))
  );
  const procurementSummary = vendorInsights?.summary || {};
  const procurementVendors = vendorInsights?.vendors || [];
  const normalizedInwardVendor = normalizeInventoryText(inwardDraft.vendorName);
  const normalizedPaymentVendor = normalizeInventoryText(paymentDraft.vendorName);
  const purchaseItemRows = masterData?.["purchase-items"] || [];
  const vendorOptions = buildSelectOptions((masterData?.vendors || []).map((row) => row.name));
  const unitOptions = buildSelectOptions((masterData?.units || []).map((row) => row.shortName || row.name));
  const itemOptions = buildSelectOptions(inventoryItems.map((row) => row.name));
  const storeOptions = buildSelectOptions((masterData?.["store-kitchen"] || []).map((row) => row.name));
  const procurementInvoiceRows = useMemo(
    () => [
      ...vendorInwards.map((row) => ({
        source: "inward",
        vendorName: row.vendorName || "",
        itemName: row.itemName || "",
        quantity: row.quantityReceived,
        unit: row.unit || "",
        rate: row.rate || "",
        amount: row.amount || "",
        invoiceNo: row.invoiceNo || "",
        date: row.receivedDate || row.createdAt || "",
        store: row.store || "",
      })),
      ...purchaseItemRows.map((row) => ({
        source: "purchase-item",
        vendorName: row.vendor || "",
        itemName: row.itemName || "",
        quantity: row.quantity,
        unit: row.unit || "",
        rate: row.ratePerUnit || "",
        amount: row.amount || "",
        invoiceNo: row.invoiceNo || "",
        date: row.date || "",
        store: row.store || "",
      })),
    ]
      .filter((row) => row.vendorName || row.invoiceNo || row.itemName)
      .sort((a, b) => getInventoryRowTimestamp(b.date) - getInventoryRowTimestamp(a.date)),
    [purchaseItemRows, vendorInwards],
  );
  const invoiceOptions = buildSelectOptions(procurementInvoiceRows.map((row) => row.invoiceNo));
  const inwardVendorHistory = useMemo(
    () => procurementInvoiceRows
      .filter((row) => normalizeInventoryText(row.vendorName) === normalizedInwardVendor)
      .sort((a, b) => getInventoryRowTimestamp(b.date) - getInventoryRowTimestamp(a.date)),
    [normalizedInwardVendor, procurementInvoiceRows],
  );
  const selectedVendorInsight = useMemo(
    () => procurementVendors.find((row) => normalizeInventoryText(row.vendorName) === normalizedInwardVendor) || null,
    [normalizedInwardVendor, procurementVendors],
  );
  const selectedVendorLatestInward = inwardVendorHistory[0] || null;
  const selectedVendorOpenPo = useMemo(
    () => records.find((row) => normalizeInventoryText(row.vendor) === normalizedInwardVendor) || null,
    [normalizedInwardVendor, records],
  );
  const selectedInwardInvoice = useMemo(
    () => procurementInvoiceRows.find((row) => String(row.invoiceNo || "").trim() === String(inwardDraft.invoiceNo || "").trim()) || null,
    [inwardDraft.invoiceNo, procurementInvoiceRows],
  );
  const vendorScopedInvoiceOptions = buildSelectOptions(inwardVendorHistory.map((row) => row.invoiceNo));
  const vendorScopedItemOptions = buildSelectOptions([
    ...inwardVendorHistory.map((row) => row.itemName),
    ...records.filter((row) => normalizeInventoryText(row.vendor) === normalizedInwardVendor).map((row) => row.itemName),
    ...inventoryItems.map((row) => row.name),
  ]);
  const paymentVendorHistory = useMemo(
    () => procurementInvoiceRows
      .filter((row) => normalizeInventoryText(row.vendorName) === normalizedPaymentVendor)
      .sort((a, b) => getInventoryRowTimestamp(b.date) - getInventoryRowTimestamp(a.date)),
    [normalizedPaymentVendor, procurementInvoiceRows],
  );
  const paymentInvoiceOptions = buildSelectOptions(
    (normalizedPaymentVendor ? paymentVendorHistory : procurementInvoiceRows).map((row) => row.invoiceNo),
  );
  const selectedPaymentInvoice = useMemo(
    () => paymentVendorHistory.find((row) => String(row.invoiceNo || "") === String(paymentDraft.invoiceRef || "")) || null,
    [paymentDraft.invoiceRef, paymentVendorHistory],
  );
  const resolveInvoiceForInwardRow = useCallback((row) => {
    if (String(row.invoiceNo || "").trim()) return row.invoiceNo;
    const normalizedVendor = normalizeInventoryText(row.vendorName);
    const normalizedItem = normalizeInventoryText(row.itemName);
    const quantity = getNormalizedNumber(row.quantityReceived);
    const amount = getNormalizedNumber(row.amount);
    const rowDate = String(row.receivedDate || "").trim();

    const quantityMatch = procurementInvoiceRows.find((entry) =>
      normalizeInventoryText(entry.vendorName) === normalizedVendor
      && normalizeInventoryText(entry.itemName) === normalizedItem
      && getNormalizedNumber(entry.quantity) === quantity
      && String(entry.invoiceNo || "").trim()
    );
    if (quantityMatch?.invoiceNo) return quantityMatch.invoiceNo;

    const amountMatch = procurementInvoiceRows.find((entry) =>
      normalizeInventoryText(entry.vendorName) === normalizedVendor
      && normalizeInventoryText(entry.itemName) === normalizedItem
      && getNormalizedNumber(entry.amount) === amount
      && String(entry.invoiceNo || "").trim()
    );
    if (amountMatch?.invoiceNo) return amountMatch.invoiceNo;

    const datedMatch = procurementInvoiceRows.find((entry) =>
      normalizeInventoryText(entry.vendorName) === normalizedVendor
      && normalizeInventoryText(entry.itemName) === normalizedItem
      && String(entry.date || "").trim() === rowDate
      && String(entry.invoiceNo || "").trim()
    );
    if (datedMatch?.invoiceNo) return datedMatch.invoiceNo;

    const latestMatch = procurementInvoiceRows.find((entry) =>
      normalizeInventoryText(entry.vendorName) === normalizedVendor
      && normalizeInventoryText(entry.itemName) === normalizedItem
      && String(entry.invoiceNo || "").trim()
    );
    return latestMatch?.invoiceNo || "";
  }, [procurementInvoiceRows]);

  const resolvedPoFields = PO_FIELDS.map((field) => {
    if (field.key === "vendor") return { ...field, type: vendorOptions.length ? "select" : field.type, options: vendorOptions, suggestions: vendorOptions };
    if (field.key === "itemName") return { ...field, type: itemOptions.length ? "select" : field.type, options: itemOptions, suggestions: itemOptions };
    if (field.key === "unit") return { ...field, type: unitOptions.length ? "select" : field.type, options: unitOptions, suggestions: unitOptions };
    return field;
  });

  const inwardFields = [
    { key: "poNumber", label: "PO Number", type: "select", options: buildSelectOptions(records.map((row) => row.poNumber)) },
    { key: "vendorName", label: "Vendor", type: vendorOptions.length ? "select" : "text", required: true, options: vendorOptions },
    { key: "itemName", label: "Item Name", type: vendorScopedItemOptions.length ? "select" : itemOptions.length ? "select" : "text", required: true, options: vendorScopedItemOptions.length ? vendorScopedItemOptions : itemOptions, suggestions: vendorScopedItemOptions.length ? vendorScopedItemOptions : itemOptions },
    { key: "quantityReceived", label: "Quantity Received", type: "number", required: true },
    { key: "unit", label: "Unit", type: unitOptions.length ? "select" : "text", options: unitOptions, suggestions: unitOptions },
    { key: "rate", label: "Rate / Unit (₹)", type: "number" },
    { key: "amount", label: "Amount (₹)", type: "number" },
    {
      key: "invoiceNo",
      label: "Invoice No",
      type: invoiceOptions.length ? "select" : "text",
      options: normalizedInwardVendor && vendorScopedInvoiceOptions.length ? vendorScopedInvoiceOptions : invoiceOptions,
      suggestions: normalizedInwardVendor && vendorScopedInvoiceOptions.length ? vendorScopedInvoiceOptions : invoiceOptions,
      allowCustom: invoiceOptions.length > 0,
    },
    { key: "batchNo", label: "Batch No", type: "text" },
    { key: "expiryDate", label: "Expiry Date", type: "date" },
    { key: "receivedDate", label: "Received Date", type: "date", required: true },
    { key: "store", label: "Store", type: storeOptions.length ? "select" : "text", options: storeOptions, suggestions: storeOptions },
    { key: "remarks", label: "Remarks", type: "text" },
  ];

  const paymentFields = [
    { key: "vendorName", label: "Vendor", type: vendorOptions.length ? "select" : "text", required: true, options: vendorOptions },
    { key: "invoiceRef", label: "Invoice Ref", type: paymentInvoiceOptions.length ? "select" : invoiceOptions.length ? "select" : "text", options: paymentInvoiceOptions.length ? paymentInvoiceOptions : invoiceOptions, suggestions: paymentInvoiceOptions.length ? paymentInvoiceOptions : invoiceOptions },
    { key: "paymentDate", label: "Payment Date", type: "date", required: true },
    { key: "amount", label: "Amount (₹)", type: "number", required: true },
    { key: "paymentMode", label: "Payment Mode", type: "select", options: ["Bank Transfer", "Cash", "UPI", "Cheque"] },
    { key: "status", label: "Status", type: "select", options: ["Scheduled", "Paid", "Partial", "Cancelled"] },
    { key: "notes", label: "Notes", type: "text" },
  ];

  const poColumns = ["poNumber", "vendor", "itemName", "quantity", "unit", "rate", "expectedDate", "status"];

  useEffect(() => {
    if (editingId) {
      setActiveTab("form");
    }
  }, [editingId]);

  const handleSave = async () => {
    const saved = await onSave();
    if (saved) {
      setActiveTab("list");
    }
  };

  const handleReset = () => {
    setDraft(buildInitialForm(PO_FIELDS));
    onEdit(null);
    setActiveTab("list");
  };

  const handleEdit = (record) => {
    onEdit(record);
    setActiveTab("form");
  };

  useEffect(() => {
    const quantity = Number(inwardDraft.quantityReceived || 0);
    const rate = Number(inwardDraft.rate || 0);
    const nextAmount = quantity > 0 && rate > 0 ? quantity * rate : 0;
    if (Number(inwardDraft.amount || 0) === nextAmount) return;
    setInwardDraft((current) => ({ ...current, amount: nextAmount ? String(nextAmount) : "" }));
  }, [inwardDraft.quantityReceived, inwardDraft.rate, inwardDraft.amount]);

  useEffect(() => {
    const po = records.find((row) => String(row.poNumber || "") === String(inwardDraft.poNumber || ""));
    if (!po) return;
    setInwardDraft((current) => ({
      ...current,
      vendorName: current.vendorName || po.vendor || "",
      itemName: current.itemName || po.itemName || "",
      unit: current.unit || po.unit || "",
      rate: current.rate || po.rate || "",
    }));
  }, [inwardDraft.poNumber, records]);

  useEffect(() => {
    if (editingInwardId || !normalizedInwardVendor) return;
    setInwardDraft((current) => {
      if (normalizeInventoryText(current.vendorName) !== normalizedInwardVendor) return current;
      const next = { ...current };

      if (!String(next.invoiceNo || "").trim() && selectedVendorLatestInward?.invoiceNo) {
        next.invoiceNo = selectedVendorLatestInward.invoiceNo;
      }
      if (!String(next.poNumber || "").trim() && selectedVendorOpenPo?.poNumber) {
        next.poNumber = selectedVendorOpenPo.poNumber;
      }
      if (!String(next.itemName || "").trim()) {
        next.itemName = selectedVendorLatestInward?.itemName || selectedVendorOpenPo?.itemName || "";
      }
      if (!String(next.unit || "").trim()) {
        next.unit = selectedVendorLatestInward?.unit || selectedVendorOpenPo?.unit || "";
      }
      if (!String(next.rate || "").trim()) {
        next.rate = selectedVendorLatestInward?.rate || selectedVendorOpenPo?.rate || "";
      }
      if (!String(next.store || "").trim()) {
        next.store = selectedVendorLatestInward?.store || "";
      }
      return next;
    });
  }, [editingInwardId, normalizedInwardVendor, selectedVendorLatestInward, selectedVendorOpenPo]);

  useEffect(() => {
    if (editingInwardId || !selectedInwardInvoice) return;
    setInwardDraft((current) => {
      if (String(current.invoiceNo || "").trim() !== String(selectedInwardInvoice.invoiceNo || "").trim()) {
        return current;
      }
      return {
        ...current,
        vendorName: selectedInwardInvoice.vendorName || current.vendorName || "",
        itemName: current.itemName || selectedInwardInvoice.itemName || "",
        unit: current.unit || selectedInwardInvoice.unit || "",
        rate: current.rate || selectedInwardInvoice.rate || "",
        store: current.store || selectedInwardInvoice.store || "",
      };
    });
  }, [editingInwardId, selectedInwardInvoice]);

  useEffect(() => {
    if (editingPaymentId || !normalizedPaymentVendor) return;
    const latestVendorInvoice = paymentVendorHistory[0] || null;
    if (!latestVendorInvoice?.invoiceNo) return;
    setPaymentDraft((current) => {
      if (normalizeInventoryText(current.vendorName) !== normalizedPaymentVendor) return current;
      return {
        ...current,
        invoiceRef: latestVendorInvoice.invoiceNo,
      };
    });
  }, [editingPaymentId, normalizedPaymentVendor, paymentVendorHistory]);

  useEffect(() => {
    if (!selectedPaymentInvoice) return;
    setPaymentDraft((current) => {
      if (String(current.invoiceRef || "") !== String(selectedPaymentInvoice.invoiceNo || "")) return current;
      return {
        ...current,
        vendorName: current.vendorName || selectedPaymentInvoice.vendorName || "",
        amount: current.amount || selectedPaymentInvoice.amount || "",
        notes: current.notes || `Payment against invoice ${selectedPaymentInvoice.invoiceNo}`,
      };
    });
  }, [selectedPaymentInvoice]);

  const handleInwardFieldChange = useCallback((key, val) => {
    setInwardDraft((current) => {
      const next = { ...current, [key]: val };
      if (key === "vendorName") {
        next.invoiceNo = "";
      }
      if (key === "invoiceNo" && val) {
        const matchedInvoice = procurementInvoiceRows.find(
          (row) => String(row.invoiceNo || "").trim() === String(val || "").trim(),
        );
        if (matchedInvoice) {
          next.vendorName = matchedInvoice.vendorName || next.vendorName || "";
          next.itemName = next.itemName || matchedInvoice.itemName || "";
          next.unit = next.unit || matchedInvoice.unit || "";
          next.rate = next.rate || matchedInvoice.rate || "";
          next.store = next.store || matchedInvoice.store || "";
        }
      }
      return next;
    });
  }, [procurementInvoiceRows]);

  const handleSaveInward = async () => {
    try {
      const resolvedInvoiceNo = String(inwardDraft.invoiceNo || "").trim()
        || resolveInvoiceForInwardRow(inwardDraft);
      const payload = {
        ...inwardDraft,
        invoiceNo: resolvedInvoiceNo,
      };
      if (editingInwardId) {
        await API.put(`/inventory/vendor-inwards/${editingInwardId}`, payload);
      } else {
        await API.post("/inventory/vendor-inwards", payload);
      }
      setInwardDraft(buildInitialForm([
        { key: "poNumber", label: "PO Number", type: "text" },
        { key: "vendorName", label: "Vendor", type: "text", required: true },
        { key: "itemName", label: "Item Name", type: "text", required: true },
        { key: "quantityReceived", label: "Quantity Received", type: "number", required: true },
        { key: "unit", label: "Unit", type: "text" },
        { key: "rate", label: "Rate / Unit (₹)", type: "number" },
        { key: "amount", label: "Amount (₹)", type: "number" },
        { key: "invoiceNo", label: "Invoice No", type: "text" },
        { key: "batchNo", label: "Batch No", type: "text" },
        { key: "expiryDate", label: "Expiry Date", type: "date" },
        { key: "receivedDate", label: "Received Date", type: "date", required: true },
        { key: "store", label: "Store", type: "text" },
        { key: "remarks", label: "Remarks", type: "text" },
      ]));
      setEditingInwardId(null);
      setOpsTab("inward-list");
      await Promise.all([refreshVendorInwards(), refreshStockLedger(), refreshStockFlowReport(), refreshInventoryItems(), refreshPurchaseOrders()]);
    } catch (err) {
      alert(err.response?.data?.message || "Vendor inward could not be saved.");
    }
  };

  const handleSavePayment = async () => {
    try {
      if (editingPaymentId) {
        await API.put(`/inventory/vendor-payments/${editingPaymentId}`, paymentDraft);
      } else {
        await API.post("/inventory/vendor-payments", paymentDraft);
      }
      setPaymentDraft(buildInitialForm([
        { key: "vendorName", label: "Vendor", type: "text", required: true },
        { key: "invoiceRef", label: "Invoice Ref", type: "text" },
        { key: "paymentDate", label: "Payment Date", type: "date", required: true },
        { key: "amount", label: "Amount (₹)", type: "number", required: true },
        { key: "paymentMode", label: "Payment Mode", type: "select", options: ["Bank Transfer", "Cash", "UPI", "Cheque"] },
        { key: "status", label: "Status", type: "select", options: ["Scheduled", "Paid", "Partial", "Cancelled"] },
        { key: "notes", label: "Notes", type: "text" },
      ]));
      setEditingPaymentId(null);
      setOpsTab("payment-list");
      await refreshVendorPayments();
    } catch (err) {
      alert(err.response?.data?.message || "Vendor payment could not be saved.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Vendors" value={procurementSummary.totalVendors || procurementVendors.length} tone="default" />
        <MetricCard label="Stock Received" value={`${Number(procurementSummary.totalReceivedQty || 0).toFixed(2).replace(/\.00$/, "")} units`} tone="cyan" />
        <MetricCard label="Received Value" value={formatCurrency(procurementSummary.totalReceivedValue || 0)} tone="emerald" />
        <MetricCard label="Outstanding Payments" value={formatCurrency(procurementSummary.totalOutstandingAmount || 0)} tone="amber" />
      </div>

      {!procurementOnly ? <SectionTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        segmented
        listIcon={FaClipboardList}
        formIcon={FaPlus}
        listLabel="PO Register"
        listHelper="View purchase order history"
        formLabel="Add PO"
        formHelper={editingId ? "Update selected purchase order" : "Open form to create a purchase order"}
      /> : null}
      {!procurementOnly && activeTab === "form" ? (
        <FormPanel
          title="Purchase Order"
          subtitle="Create PO → Send to vendor → Mark GRN Received"
          fields={resolvedPoFields}
          draft={draft}
          setDraft={setDraft}
          editingId={editingId}
          onSave={handleSave}
          onReset={handleReset}
        />
      ) : null}
      {!procurementOnly && activeTab === "list" ? (
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-3xl font-semibold text-slate-900">Purchase Order Register</h3>
              <p className="text-xl text-slate-400">{records.length} purchase orders</p>
            </div>
            <div className="w-80">
              <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search PO / vendor" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-lg">
              <thead className="bg-slate-50 text-sm font-semibold uppercase tracking-widest text-slate-400 text-left">
                <tr>
                  {poColumns.map((col) => <th key={col} className="px-4 py-4">{formatLabel(col)}</th>)}
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((row) => {
                  const statusColors = {
                    Draft: "gray", Sent: "cyan", "GRN Received": "green",
                    Closed: "emerald", Cancelled: "red",
                  };
                  return (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-4 font-semibold text-slate-900">{row.poNumber}</td>
                      <td className="px-4 py-4 text-slate-700">{row.vendor}</td>
                      <td className="px-4 py-4 text-slate-700">{row.itemName}</td>
                      <td className="px-4 py-4">{row.quantity}</td>
                      <td className="px-4 py-4 text-slate-500">{row.unit}</td>
                      <td className="px-4 py-4">{formatCurrency(row.rate)}</td>
                      <td className="px-4 py-4 text-base text-slate-500">{row.expectedDate || "—"}</td>
                      <td className="px-4 py-4">
                        <Badge color={statusColors[row.status] || "gray"}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEdit(row)}
                            className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-base font-semibold text-cyan-700 hover:bg-cyan-100 transition">
                            <FaEdit size={10} /> Edit
                          </button>
                          <button type="button" onClick={() => onDelete(row.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-base font-semibold text-red-600 hover:bg-red-100 transition">
                            <FaTrash size={10} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-xl text-slate-400">No purchase orders found. Create your first PO above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {procurementOnly ? (
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900">Real Procurement Flow</h3>
            <p className="text-base text-slate-400">Vendor inward, payment tracking, and stock ledger from real inventory data.</p>
          </div>
          <div className="w-full xl:w-80">
            <SearchBar value={opsSearch} onChange={setOpsSearch} placeholder="Search inward / payment / ledger" />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          {[
            { id: "inward-form", label: editingInwardId ? "Edit Stock Inward" : "Add Stock Inward" },
            { id: "inward-list", label: "Inward History" },
            { id: "payment-form", label: editingPaymentId ? "Edit Vendor Payment" : "Add Vendor Payment" },
            { id: "payment-list", label: "Payment History" },
            { id: "ledger", label: "Stock Ledger" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOpsTab(tab.id)}
              className={`inline-flex min-h-[46px] items-center gap-2.5 rounded-full border px-5 py-3 text-[15px] font-semibold transition ${
                opsTab === tab.id
                  ? "border-transparent bg-[linear-gradient(90deg,#2563eb_0%,#1d4ed8_100%)] text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)]"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {opsTab === "inward-form" ? (
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.06)]">
            <div className="mb-4 text-[1.65rem] font-bold text-slate-950">{editingInwardId ? "Edit Stock Inward" : "Add Stock Inward"}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {inwardFields.map((field) => (
                { key: "rate", label: "Rate / Unit (₹)", type: "number" },
                { key: "amount", label: "Amount (₹)", type: "number" },
                <div key={field.key}>
                  <label className="mb-2 block text-[16px] font-semibold text-slate-800">{field.label}</label>
                  <FormInput
                    field={field}
                    value={inwardDraft[field.key] ?? ""}
                    onChange={handleInwardFieldChange}
                  />
                </div>
              ))}
            </div>
            {normalizedInwardVendor ? (
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">
                  Vendor history: {inwardDraft.vendorName}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
                  <span>Total received: {Number(selectedVendorInsight?.totalQty || 0).toFixed(2).replace(/\.00$/, "")} {selectedVendorLatestInward?.unit || "units"}</span>
                  <span>Receipts: {selectedVendorInsight?.receiptsCount || inwardVendorHistory.length}</span>
                  <span>Last invoice: {selectedVendorLatestInward?.invoiceNo || "—"}</span>
                  <span>Last received: {selectedVendorLatestInward?.receivedDate || selectedVendorInsight?.lastReceivedDate || "—"}</span>
                </div>
                <div className="mt-2 text-slate-500">
                  Vendor select karte hi latest inward se invoice no auto-fill hota hai. Item, unit, rate aur store bhi previous inward ya matching PO se prefill ho sakte hain.
                </div>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={handleSaveInward} className="rounded-xl bg-[linear-gradient(90deg,#2563eb_0%,#1d4ed8_100%)] px-6 py-3.5 text-[15px] font-semibold text-white">
                {editingInwardId ? "Update Stock Inward" : "Save Stock Inward"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingInwardId(null);
                  setInwardDraft(buildInitialForm([
                    { key: "poNumber", label: "PO Number", type: "text" },
                    { key: "vendorName", label: "Vendor", type: "text", required: true },
                    { key: "itemName", label: "Item Name", type: "text", required: true },
                    { key: "quantityReceived", label: "Quantity Received", type: "number", required: true },
                    { key: "unit", label: "Unit", type: "text" },
                    { key: "rate", label: "Rate / Unit (₹)", type: "number" },
                    { key: "amount", label: "Amount (₹)", type: "number" },
                    { key: "invoiceNo", label: "Invoice No", type: "text" },
                    { key: "batchNo", label: "Batch No", type: "text" },
                    { key: "expiryDate", label: "Expiry Date", type: "date" },
                    { key: "receivedDate", label: "Received Date", type: "date", required: true },
                    { key: "store", label: "Store", type: "text" },
                    { key: "remarks", label: "Remarks", type: "text" },
                  ]));
                }}
                className="rounded-xl border border-slate-200 px-5 py-3.5 text-[15px] font-semibold text-slate-700"
              >
                Clear
              </button>
            </div>
            <div className="mt-4 text-[16px] font-semibold text-slate-500">
              Tip: agar item name exact inventory item se match karta hai, to inward save hote hi stock real data mein increase ho jayega.
            </div>
          </div>
        ) : null}

        {opsTab === "inward-list" ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 text-left">
                <tr>
                  {["vendorName", "itemName", "quantityReceived", "unit", "amount", "invoiceNo", "batchNo", "expiryDate", "receivedDate", "store"].map((col) => (
                    <th key={col} className="px-4 py-4">{formatLabel(col)}</th>
                  ))}
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInwards.length ? filteredInwards.map((row) => {
                  const resolvedInvoiceNo = resolveInvoiceForInwardRow(row);
                  return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">{row.vendorName}</td>
                    <td className="px-4 py-4 text-slate-700">{row.itemName}</td>
                    <td className="px-4 py-4 text-slate-700">{row.quantityReceived}</td>
                    <td className="px-4 py-4 text-slate-500">{row.unit || "—"}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-4 text-slate-500">{resolvedInvoiceNo || "—"}</td>
                    <td className="px-4 py-4 text-slate-500">{row.batchNo || "—"}</td>
                    <td className="px-4 py-4 text-slate-500">
                      <div className="flex flex-col gap-1">
                        <span>{row.expiryDate || "—"}</span>
                        {row.expiryDate ? (
                          <Badge
                            color={
                              getExpiryStatus(row.expiryDate)?.label === "Expired"
                                ? "red"
                                : getExpiryStatus(row.expiryDate)?.label === "Expiring Soon"
                                  ? "amber"
                                  : "green"
                            }
                          >
                            {getExpiryStatus(row.expiryDate)?.label || "Healthy"}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500">{row.receivedDate || "—"}</td>
                    <td className="px-4 py-4 text-slate-500">{row.store || "—"}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setEditingInwardId(row.id); setInwardDraft({ ...buildInitialForm(inwardFields), ...row, invoiceNo: resolvedInvoiceNo || row.invoiceNo || "" }); setOpsTab("inward-form"); }} className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"><FaEdit size={10} /> Edit</button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await API.delete(`/inventory/vendor-inwards/${row.id}`);
                              await Promise.all([
                                refreshVendorInwards(),
                                refreshStockLedger(),
                                refreshStockFlowReport(),
                                refreshInventoryItems(),
                                refreshPurchaseOrders(),
                              ]);
                            } catch (err) {
                              alert(err.response?.data?.message || "Vendor inward could not be deleted.");
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                        >
                          <FaTrash size={10} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                }) : <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">No inward entries found.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : null}

        {opsTab === "payment-form" ? (
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.06)]">
            <div className="mb-4 text-[1.65rem] font-bold text-slate-950">{editingPaymentId ? "Edit Vendor Payment" : "Add Vendor Payment"}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {paymentFields.map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-[16px] font-semibold text-slate-800">{field.label}</label>
                  <FormInput
                    field={field}
                    value={paymentDraft[field.key] ?? ""}
                    onChange={(key, val) => setPaymentDraft((current) => ({ ...current, [key]: val }))}
                  />
                </div>
              ))}
            </div>
            {normalizedPaymentVendor ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">
                  Payment context: {paymentDraft.vendorName}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
                  <span>Invoice options: {paymentInvoiceOptions.length}</span>
                  <span>Latest invoice: {paymentVendorHistory[0]?.invoiceNo || "—"}</span>
                  <span>Latest amount: {formatCurrency(paymentVendorHistory[0]?.amount || 0)}</span>
                </div>
                <div className="mt-2 text-slate-500">
                  Vendor select karne par invoice ref us vendor ke inward history tak limit ho jata hai aur latest invoice auto-select ho jata hai.
                </div>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={handleSavePayment} className="rounded-xl bg-[linear-gradient(90deg,#16a34a_0%,#15803d_100%)] px-5 py-3 text-sm font-semibold text-white">
                {editingPaymentId ? "Update Vendor Payment" : "Save Vendor Payment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingPaymentId(null);
                  setPaymentDraft(buildInitialForm([
                    { key: "vendorName", label: "Vendor", type: "text", required: true },
                    { key: "invoiceRef", label: "Invoice Ref", type: "text" },
                    { key: "paymentDate", label: "Payment Date", type: "date", required: true },
                    { key: "amount", label: "Amount (₹)", type: "number", required: true },
                    { key: "paymentMode", label: "Payment Mode", type: "select", options: ["Bank Transfer", "Cash", "UPI", "Cheque"] },
                    { key: "status", label: "Status", type: "select", options: ["Scheduled", "Paid", "Partial", "Cancelled"] },
                    { key: "notes", label: "Notes", type: "text" },
                  ]));
                }}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {opsTab === "payment-list" ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 text-left">
                <tr>
                  {["vendorName", "invoiceRef", "paymentDate", "amount", "paymentMode", "status"].map((col) => (
                    <th key={col} className="px-4 py-4">{formatLabel(col)}</th>
                  ))}
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length ? filteredPayments.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">{row.vendorName}</td>
                    <td className="px-4 py-4 text-slate-700">{row.invoiceRef || "—"}</td>
                    <td className="px-4 py-4 text-slate-500">{row.paymentDate || "—"}</td>
                    <td className="px-4 py-4 font-semibold text-emerald-600">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-4 text-slate-500">{row.paymentMode || "—"}</td>
                    <td className="px-4 py-4"><Badge color={String(row.status || "").toLowerCase().includes("paid") ? "green" : String(row.status || "").toLowerCase().includes("cancel") ? "red" : "amber"}>{row.status || "Scheduled"}</Badge></td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setEditingPaymentId(row.id); setPaymentDraft({ ...buildInitialForm([]), ...row }); setOpsTab("payment-form"); }} className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"><FaEdit size={10} /> Edit</button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await API.delete(`/inventory/vendor-payments/${row.id}`);
                              await refreshVendorPayments();
                            } catch (err) {
                              alert(err.response?.data?.message || "Vendor payment could not be deleted.");
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                        >
                          <FaTrash size={10} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No vendor payments found.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : null}

        {opsTab === "ledger" ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 text-left">
                <tr>
                  {["entryDate", "itemName", "referenceType", "direction", "quantity", "unit", "vendorName", "amount", "balanceAfter"].map((col) => (
                    <th key={col} className="px-4 py-4">{formatLabel(col)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length ? filteredLedger.map((row) => (
                  <tr key={`${row.referenceType}-${row.id}-${row.createdAt || row.entryDate}`} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-500">{row.entryDate || "—"}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{row.itemName || "—"}</td>
                    <td className="px-4 py-4 text-slate-700">{formatLabel(row.referenceType || "entry")}</td>
                    <td className="px-4 py-4"><Badge color={String(row.direction || "").toUpperCase() === "OUT" ? "red" : "green"}>{String(row.direction || "IN").toUpperCase()}</Badge></td>
                    <td className="px-4 py-4 text-slate-700">{row.quantity}</td>
                    <td className="px-4 py-4 text-slate-500">{row.unit || "—"}</td>
                    <td className="px-4 py-4 text-slate-500">{row.vendorName || "—"}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(row.amount || 0)}</td>
                    <td className="px-4 py-4 text-slate-500">{row.balanceAfter ?? "—"}</td>
                  </tr>
                )) : <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">No stock ledger rows found.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function PurchaseWorkspaceSection({ records, masterData, onSave, onEdit, onDelete, draft, setDraft, editingId, searchQuery, setSearchQuery, setActiveSection }) {
  const [activeTab, setActiveTab] = useState("form");
  const filtered = records.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const poColumns = ["poNumber", "vendor", "itemName", "quantity", "unit", "rate", "expectedDate", "status"];
  const purchaseItems = masterData["purchase-items"] || [];
  const purchaseServices = masterData["purchase-services"] || [];
  const totalSpend = [...purchaseItems, ...purchaseServices].reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const openOrders = records.filter((row) => !["Closed", "Cancelled"].includes(String(row.status || ""))).length;
  const pendingOrders = records.filter((row) => ["Draft", "Sent"].includes(String(row.status || ""))).length;
  const recentPurchases = [...records]
    .sort((a, b) => new Date(b.expectedDate || 0) - new Date(a.expectedDate || 0))
    .slice(0, 3);
  const purchaseTabs = [
    { id: "purchase-items", label: "Purchase Items" },
    { id: "purchase-services", label: "Purchase Services" },
    { id: "purchase-orders", label: "Purchase Orders" },
  ];

  useEffect(() => {
    if (editingId) {
      setActiveTab("form");
    }
  }, [editingId]);

  const handleSave = async () => {
    const saved = await onSave();
    if (saved) {
      setActiveTab("list");
    }
  };

  const handleReset = () => {
    setDraft(buildInitialForm(PO_FIELDS));
    onEdit(null);
    setActiveTab("form");
  };

  const handleEdit = (record) => {
    onEdit(record);
    setActiveTab("form");
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Orders", value: records.length, meta: "+12%", tone: "bg-emerald-50 text-emerald-600", icon: FaClipboardList },
          { label: "Spend (MTD)", value: formatCurrency(totalSpend), meta: "+5.2%", tone: "bg-orange-50 text-orange-500", icon: FaChartBar },
          { label: "Open Orders", value: openOrders, meta: "Active", tone: "bg-violet-50 text-violet-600", icon: FaTruck },
          { label: "Pending Tasks", value: String(pendingOrders).padStart(2, "0"), meta: "", tone: "bg-orange-50 text-orange-500", icon: FaExclamationTriangle },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-[24px] border border-white/70 bg-white/95 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</div>
                  <div className="mt-1 text-3xl font-bold text-slate-900">{card.value}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {card.meta ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{card.meta}</span> : null}
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${card.tone}`}>
                    <Icon size={13} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-3xl font-semibold text-slate-900">Purchases Overview</h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Manage procurement workflows and vendor relationships.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {purchaseTabs.map((tab) => {
                const active = tab.id === "purchase-orders";
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      active ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr),320px]">
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                <FaPlus size={11} />
              </span>
              <div className="text-lg font-bold">{editingId ? "Edit Purchase" : "Add Purchase"}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {PO_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-xs font-semibold text-slate-500">{field.label}</label>
                  <FormInput
                    field={field}
                    value={draft[field.key] ?? ""}
                    onChange={(key, val) => setDraft((current) => ({ ...current, [key]: val }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-[linear-gradient(90deg,#fb923c_0%,#f97316_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(249,115,22,0.24)]"
              >
                {editingId ? "Update Purchase" : "Register Purchase"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-lg font-bold text-slate-900">Recent Purchases</div>
                <button type="button" onClick={() => setActiveTab("list")} className="text-xs font-semibold text-blue-600">View All</button>
              </div>
              <div className="space-y-3">
                {recentPurchases.length ? recentPurchases.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <FaClipboardList size={11} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{row.itemName || row.poNumber}</div>
                        <div className="text-[11px] text-slate-400">{row.vendor} • {row.expectedDate || "Scheduled"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-orange-500">{formatCurrency(Number(row.rate || 0) * Number(row.quantity || 1))}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-500">{row.status || "Open"}</div>
                    </div>
                  </div>
                )) : <div className="text-sm text-slate-400">No recent purchase orders.</div>}
              </div>
            </div>

            <div className="overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#1f2937_0%,#374151_45%,#111827_100%)] shadow-[0_18px_35px_rgba(15,23,42,0.16)]">
              <div className="h-28 bg-[linear-gradient(135deg,rgba(251,146,60,0.2),rgba(255,255,255,0.05))]" />
              <div className="p-4 text-white">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300">Top Active Vendor</div>
                <div className="mt-1 text-lg font-bold">{records[0]?.vendor || "Vendor Insights"}</div>
                <div className="mt-1 text-xs text-white/70">Vendor performance snapshot and delivery confidence.</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-900">Purchase Trend (Weekly)</div>
                <span className="text-violet-500">↗</span>
              </div>
              <div className="flex h-20 items-end gap-2">
                {[20, 34, 52, 28, 41, 22, 16].map((value, index) => (
                  <div key={index} className={`flex-1 rounded-t-md ${index === 2 ? "bg-orange-500" : "bg-slate-200"}`} style={{ height: `${value}px` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeTab === "list" ? (
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-slate-900">Purchase Order Register</h3>
              <p className="text-sm text-slate-400">{records.length} purchase orders</p>
            </div>
            <div className="w-80">
              <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search PO / vendor" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 text-left">
                <tr>
                  {poColumns.map((col) => <th key={col} className="px-4 py-4">{formatLabel(col)}</th>)}
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? filtered.map((row) => {
                  const statusColors = {
                    Draft: "gray", Sent: "cyan", "GRN Received": "green",
                    Closed: "emerald", Cancelled: "red",
                  };
                  return (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-4 font-semibold text-slate-900">{row.poNumber}</td>
                      <td className="px-4 py-4 text-slate-700">{row.vendor}</td>
                      <td className="px-4 py-4 text-slate-700">{row.itemName}</td>
                      <td className="px-4 py-4">{row.quantity}</td>
                      <td className="px-4 py-4 text-slate-500">{row.unit}</td>
                      <td className="px-4 py-4">{formatCurrency(row.rate)}</td>
                      <td className="px-4 py-4 text-sm text-slate-500">{row.expectedDate || "—"}</td>
                      <td className="px-4 py-4">
                        <Badge color={statusColors[row.status] || "gray"}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEdit(row)}
                            className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100 transition">
                            <FaEdit size={10} /> Edit
                          </button>
                          <button type="button" onClick={() => onDelete(row.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
                            <FaTrash size={10} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">No purchase orders found. Create your first PO above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Section: Waste / Spoilage Log ────────────────────────────────────────────

function WasteLogSection({ records, onSave, onEdit, onDelete, draft, setDraft, editingId, searchQuery, setSearchQuery, inventoryItems, masterData }) {
  const [activeTab, setActiveTab] = useState("form");
  const filtered = records.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const wasteColumns = ["itemName", "quantity", "unit", "reason", "store", "remarks", "date"];
  const totalWaste = records.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

  useEffect(() => {
    if (editingId) {
      setActiveTab("form");
    }
  }, [editingId]);

  const handleSave = async () => {
    const saved = await onSave();
    if (saved) {
      setActiveTab("list");
    }
  };

  const handleReset = () => {
    setDraft(buildInitialForm(WASTE_FIELDS));
    onEdit(null);
    setActiveTab("list");
  };

  const handleEdit = (record) => {
    onEdit(record);
    setActiveTab("form");
  };

  const wasteItemOptions = buildSelectOptions(inventoryItems.map((row) => row.name));
  const wasteUnitOptions = buildSelectOptions([
    ...inventoryItems.map((row) => row.unit),
    ...(masterData?.units || []).map((row) => row.shortName || row.name),
  ]);
  const wasteStoreOptions = buildSelectOptions([
    ...inventoryItems.map((row) => row.branch),
    ...(masterData?.["store-kitchen"] || []).map((row) => row.name),
  ]);
  const resolvedWasteFields = WASTE_FIELDS.map((field) => {
    if (field.key === "itemName") return { ...field, type: wasteItemOptions.length ? "select" : field.type, options: wasteItemOptions, suggestions: wasteItemOptions };
    if (field.key === "unit") return { ...field, type: wasteUnitOptions.length ? "select" : field.type, options: wasteUnitOptions, suggestions: wasteUnitOptions };
    if (field.key === "store") return { ...field, type: wasteStoreOptions.length ? "select" : field.type, options: wasteStoreOptions, suggestions: wasteStoreOptions };
    return field;
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Waste Entries" value={records.length} tone="red" />
        <MetricCard label="Total Qty Wasted" value={totalWaste} sub="units across all items" tone="amber" />
        <MetricCard label="Top Reason" value={records.length ? records.reduce((acc, r) => { acc[r.reason] = (acc[r.reason] || 0) + 1; return acc; }, {}) && Object.entries(records.reduce((acc, r) => { acc[r.reason] = (acc[r.reason] || 0) + 1; return acc; }, {})).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—" : "—"} tone="default" />
      </div>
      <SectionTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        segmented
        listIcon={FaClipboardList}
        formIcon={FaPlus}
        listLabel="Waste Register"
        listHelper="View all waste and spoilage entries"
        formLabel="Add Waste Register"
        formHelper={editingId ? "Update selected waste entry" : "Open form to log a new waste entry"}
      />
      {activeTab === "form" ? (
        <FormPanel
          title="Waste / Spoilage Entry"
          subtitle="Log expired, damaged or wasted items"
          fields={resolvedWasteFields}
          draft={draft}
          setDraft={setDraft}
          editingId={editingId}
          onSave={handleSave}
          onReset={handleReset}
        />
      ) : null}
      {activeTab === "list" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Waste Log Register</h3>
              <p className="text-base text-slate-400">{records.length} entries recorded</p>
            </div>
            <div className="w-64">
              <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search waste entry" />
            </div>
          </div>
          <DataTable columns={wasteColumns} rows={filtered} onEdit={handleEdit} onDelete={onDelete} emptyMessage="No waste entries recorded." />
        </div>
      ) : null}
    </div>
  );
}

// ─── Section: Stock Audit ─────────────────────────────────────────────────────

function StockAuditSection({ items, onSubmit, isSubmitting }) {
  const [auditData, setAuditData] = useState(() =>
    items.map((item) => ({
      id: item.id, name: item.name, category: item.category, branch: item.branch,
      unit: item.unit, systemStock: item.stock, physicalStock: "", remarks: "",
    }))
  );
  const [submitted, setSubmitted] = useState(false);
  const [showValidationNotice, setShowValidationNotice] = useState(false);

  useEffect(() => {
    setAuditData(
      items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        branch: item.branch,
        unit: item.unit,
        systemStock: item.stock,
        physicalStock: "",
        remarks: "",
      }))
    );
    setSubmitted(false);
    setShowValidationNotice(false);
  }, [items]);

  const handlePhysicalChange = (id, val) => {
    if (showValidationNotice && val !== "") {
      setShowValidationNotice(false);
    }
    setAuditData((d) => d.map((r) => r.id === id ? { ...r, physicalStock: val } : r));
  };
  const handleRemarks = (id, val) => {
    setAuditData((d) => d.map((r) => r.id === id ? { ...r, remarks: val } : r));
  };

  const auditResults = auditData.map((r) => {
    const sys = Number(r.systemStock || 0);
    const phy = Number(r.physicalStock || 0);
    const diff = phy - sys;
    return { ...r, variance: r.physicalStock !== "" ? diff : null };
  });

  const withVariance = auditResults.filter((r) => r.variance !== null && r.variance !== 0);

  const handleSubmit = async () => {
    const entries = auditResults.filter((row) => row.physicalStock !== "");
    if (!entries.length) {
      setShowValidationNotice(true);
      return;
    }

    setShowValidationNotice(false);
    const success = await onSubmit(entries);
    if (success) {
      setSubmitted(true);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] border border-amber-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#fef3c7_100%)] px-5 py-4 shadow-[0_18px_40px_rgba(245,158,11,0.12)] flex items-start gap-3">
        <FaExclamationTriangle className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-base font-semibold text-amber-800">Physical Stock Audit Mode</p>
          <p className="mt-0.5 text-sm text-amber-600">Enter physical count for each item. System will calculate variance automatically.</p>
        </div>
      </div>

      {submitted && withVariance.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-base font-semibold text-red-700">{withVariance.length} variance(s) detected</p>
          <div className="space-y-1">
            {withVariance.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm text-red-600">
                <FaArrowRight size={10} />
                <span className="font-medium">{r.name}</span>: System {r.systemStock} {r.unit} vs Physical {r.physicalStock} {r.unit}
                <span className={`font-bold ${r.variance < 0 ? "text-red-700" : "text-emerald-600"}`}>
                  ({r.variance > 0 ? "+" : ""}{r.variance})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Physical Count Sheet</h3>
            <p className="text-base text-slate-400">{items.length} items to audit</p>
          </div>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-base font-semibold text-white transition hover:opacity-90">
            <FaCheckCircle size={13} /> {isSubmitting ? "Submitting..." : "Submit Audit"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-lg">
            <thead className="bg-slate-50 text-sm font-semibold uppercase tracking-widest text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">System Stock</th>
                <th className="px-4 py-3">Physical Count</th>
                <th className="px-4 py-3">Variance</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {auditResults.map((row) => {
                const hasVariance = row.variance !== null && row.variance !== 0;
                return (
                  <tr key={row.id} className={`border-t border-slate-100 ${hasVariance ? "bg-red-50/40" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-500">{row.category}</td>
                    <td className="px-4 py-3 text-slate-500">{row.branch}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.systemStock} <span className="font-normal text-slate-400 text-xs">{row.unit}</span></td>
                    <td className="px-4 py-3">
                      <input type="number" value={row.physicalStock}
                        onChange={(e) => handlePhysicalChange(row.id, e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition"
                        placeholder="Enter count" />
                    </td>
                    <td className="px-4 py-3">
                      {row.variance !== null ? (
                        <span className={`font-bold text-sm ${row.variance < 0 ? "text-red-600" : row.variance > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {row.variance > 0 ? "+" : ""}{row.variance} {row.unit}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" value={row.remarks}
                        onChange={(e) => handleRemarks(row.id, e.target.value)}
                        className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-cyan-400 transition"
                        placeholder="Optional" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showValidationNotice ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => setShowValidationNotice(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-amber-200/80 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,#fff7ed_42%,#ffffff_100%)] px-6 pb-5 pt-6">
              <button
                type="button"
                onClick={() => setShowValidationNotice(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/80 text-slate-500 shadow-sm transition hover:text-slate-700"
              >
                <FaTimes />
              </button>

              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">
                <FaExclamationTriangle className="text-amber-500" />
                Audit Notice
              </div>

              <div className="mt-5 flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_100%)] text-white shadow-[0_20px_40px_rgba(249,115,22,0.28)]">
                  <FaClipboardList size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Physical count missing</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Submit karne se pehle kam se kam ek item ka physical count enter kijiye. Tabhi audit variance calculate hoga.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="rounded-[22px] border border-amber-100 bg-[linear-gradient(135deg,#fffbeb_0%,#fff7ed_100%)] p-4">
                <div className="text-sm font-bold uppercase tracking-[0.2em] text-amber-700">Quick fix</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Table me kisi bhi row ke <span className="font-semibold text-slate-800">Physical Count</span> field ko fill karke dubara
                  <span className="font-semibold text-slate-800"> Submit Audit</span> dabaiye.
                </p>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowValidationNotice(false)}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_30px_rgba(249,115,22,0.24)] transition hover:scale-[1.01] hover:shadow-[0_22px_36px_rgba(249,115,22,0.28)]"
                >
                  <FaCheckCircle size={14} />
                  OK, I'll add count
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Section: Reports ─────────────────────────────────────────────────────────

function ReportSection({
  title,
  subtitle,
  columns,
  rows,
  stockFlowSummary = null,
  stockFlowFilters = null,
  onStockFlowFilterChange = null,
}) {
  const isStockFlowReport = columns.some((column) => column.key === "openingQty") && columns.some((column) => column.key === "remainingStock");
  const derivedStockFlowSummary = useMemo(() => {
    if (!isStockFlowReport) return null;
    return rows.reduce((summary, row) => {
      const opening = Number(String(row.openingQty || "").split(" ")[0] || 0);
      const received = Number(String(row.receivedQty || "").split(" ")[0] || 0);
      const used = Number(String(row.usedQty || "").split(" ")[0] || 0);
      const remaining = Number(String(row.remainingStock || "").split(" ")[0] || 0);
      return {
        opening: summary.opening + opening,
        received: summary.received + received,
        used: summary.used + used,
        remaining: summary.remaining + remaining,
      };
    }, { opening: 0, received: 0, used: 0, remaining: 0 });
  }, [isStockFlowReport, rows]);
  const resolvedStockFlowSummary = stockFlowSummary || derivedStockFlowSummary;

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-base text-slate-400">{subtitle}</p>}
      </div>
      {isStockFlowReport ? (
        <div className="space-y-4">
          {stockFlowFilters && onStockFlowFilterChange ? (
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Date From</div>
                <input
                  type="date"
                  value={stockFlowFilters.dateFrom || ""}
                  onChange={(event) => onStockFlowFilterChange("dateFrom", event.target.value)}
                  className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-300"
                />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Date To</div>
                <input
                  type="date"
                  value={stockFlowFilters.dateTo || ""}
                  onChange={(event) => onStockFlowFilterChange("dateTo", event.target.value)}
                  className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-300"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  onStockFlowFilterChange("dateFrom", "");
                  onStockFlowFilterChange("dateTo", "");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Clear Dates
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Opening", value: resolvedStockFlowSummary?.opening ?? 0, tone: "border-slate-200 bg-slate-50 text-slate-900" },
              { label: "Total Received", value: resolvedStockFlowSummary?.received ?? 0, tone: "border-cyan-200 bg-cyan-50 text-cyan-800" },
              { label: "Total Used", value: resolvedStockFlowSummary?.used ?? 0, tone: "border-amber-200 bg-amber-50 text-amber-800" },
              { label: "Total Remaining", value: resolvedStockFlowSummary?.remaining ?? 0, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl border px-4 py-4 ${card.tone}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{card.label}</div>
                <div className="mt-2 text-2xl font-bold">{formatQuantity(card.value)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Stock sequence flow</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {["Opening Qty", "Received Qty", "Used Qty", "Remaining Stock", "Amount"].map((label, index) => (
                <React.Fragment key={label}>
                  <span className="rounded-full border border-white/80 bg-white px-3 py-1.5 font-medium text-slate-700">{label}</span>
                  {index < 4 ? <span className="text-slate-400">→</span> : null}
                </React.Fragment>
              ))}
            </div>
            <div className="mt-2 text-slate-500">
              Formula: Opening + Received - Used = Remaining. Amount = Remaining Stock × Unit Rate.
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 text-left">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="px-4 py-4">{formatLabel(column.key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row, index) => {
                  const isLow = String(row.alert || "").toLowerCase().includes("low");
                  return (
                    <tr key={`${row.item || index}-${index}`} className={`border-t border-slate-100 ${isLow ? "bg-amber-50/60" : "hover:bg-slate-50/70"}`}>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-4 py-4 ${column.key === "alert" && isLow ? "font-semibold text-amber-700" : "text-slate-700"} ${column.key === "amount" ? "font-semibold text-slate-900" : ""}`}
                        >
                          {row[column.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">No report data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <DataTable columns={columns.map((c) => c.key)} rows={rows.map((r, i) => ({ id: i, ...r }))} emptyMessage="No report data available." />
      )}
    </div>
  );
}

// ─── Low Stock Alerts Banner ──────────────────────────────────────────────────

function LowStockAlerts({ items }) {
  const lowItems = items.filter(isLowStock);
  const expiredItems = items.filter((i) => {
    if (!i.expiry) return false;
    return new Date(i.expiry) <= new Date();
  });

  if (lowItems.length === 0 && expiredItems.length === 0) return null;

  return (
    <div className="rounded-[26px] border border-sky-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(240,249,255,0.92)_52%,rgba(224,242,254,0.88)_100%)] p-5 shadow-[0_24px_50px_rgba(56,189,248,0.14)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-[0_10px_20px_rgba(239,68,68,0.12)]">
          <FaBell size={16} />
        </span>
        <h4 className="text-[1.45rem] font-bold text-slate-900">Inventory Alerts</h4>
      </div>
      <div className="flex flex-wrap gap-3">
        {lowItems.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)] px-4 py-2 text-base font-bold text-red-700 shadow-[0_12px_24px_rgba(248,113,113,0.12)]">
            <FaExclamationTriangle size={13} className="text-red-500" />
            {item.name}: {item.stock} {item.unit} left
          </span>
        ))}
        {expiredItems.map((item) => (
          <span key={`exp-${item.id}`} className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-[linear-gradient(135deg,#ffe4e6_0%,#ffffff_100%)] px-4 py-2 text-base font-bold text-red-700 shadow-[0_12px_24px_rgba(239,68,68,0.14)]">
            <FaCalendarAlt size={13} className="text-red-500" />
            {item.name}: Expired
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function InventoryDashboard({ procurementOnly = false }) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("items");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");

  const [sectionSearch, setSectionSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [itemsForm, setItemsForm] = useState(buildInitialForm(ITEMS_FORM));
  const [editingItemId, setEditingItemId] = useState(null);

  const [masterData, setMasterData] = useState(() =>
    Object.keys(STORAGE_KEYS).reduce((acc, key) => {
      acc[key] = API_BACKED_MASTER_SECTIONS.has(key)
        ? []
        : loadStoredValue(STORAGE_KEYS[key], DEFAULT_MASTER_DATA[key] || []);
      return acc;
    }, {})
  );
  const [masterDraft, setMasterDraft] = useState({});
  const [editingMasterId, setEditingMasterId] = useState(null);
  const [menuDraft, setMenuDraft] = useState(buildInitialForm(MENU_ITEM_FIELDS));
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuItemsData, setMenuItemsData] = useState([]);
  const [auditReportRows, setAuditReportRows] = useState([]);
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState(NAVIGATION_GROUPS[0]?.label || "");
  const [vendorInwards, setVendorInwards] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [stockLedgerRows, setStockLedgerRows] = useState([]);
  const [stockFlowReportRows, setStockFlowReportRows] = useState([]);
  const [consumptionLogRows, setConsumptionLogRows] = useState([]);
  const [stockFlowReportSummary, setStockFlowReportSummary] = useState({
    opening: 0,
    received: 0,
    used: 0,
    remaining: 0,
    amount: 0,
  });
  const [stockFlowFilters, setStockFlowFilters] = useState({ dateFrom: "", dateTo: "" });
  const [vendorInsights, setVendorInsights] = useState({ summary: {}, vendors: [] });

  useEffect(() => {
    if (!procurementOnly) return;
    setActiveSection("purchase-orders");
    setOpenNavGroup("Purchases");
  }, [procurementOnly]);

  // Load inventory items from API
  useEffect(() => {
    const load = async () => {
      try {
        setItemsLoading(true);
        const masterSectionEntries = await Promise.all(
          Object.entries(INVENTORY_MASTER_API_SECTION_MAP).map(async ([sectionKey, apiSectionKey]) => {
            const records = await fetchInventoryMasterRecords(apiSectionKey);
            return [sectionKey, records];
          }),
        );
        const [
          inventoryRes,
          menuRes,
          wasteRes,
          purchaseOrdersRes,
          transfersRes,
          auditReportRes,
          vendorInwardsRes,
          vendorPaymentsRes,
          stockLedgerRes,
          stockFlowRes,
          consumptionLogRes,
          vendorInsightsRes,
        ] = await Promise.all([
          API.get("/inventory"),
          API.get("/restaurant/menu"),
          API.get("/inventory/waste"),
          API.get("/inventory/purchase-orders"),
          API.get("/inventory/transfers"),
          API.get("/inventory/audit/report"),
          API.get("/inventory/vendor-inwards"),
          API.get("/inventory/vendor-payments"),
          API.get("/inventory/stock-ledger"),
          API.get("/inventory/reports/stock-flow"),
          API.get("/menu-recipes/consumption-log", { params: { limit: 500 } }),
          API.get("/inventory/vendor-insights"),
        ]);
        const nextMasterSections = Object.fromEntries(masterSectionEntries);
        setInventoryItems(Array.isArray(inventoryRes.data) ? inventoryRes.data : []);
        setMenuItemsData(
          (Array.isArray(menuRes.data) ? menuRes.data : []).map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category || "",
            price: Number(item.price || 0),
            imageUrl: item.image_url || item.imageUrl || "",
            description: item.description || "",
            foodType: item.food_type || item.foodType || "Veg",
            status: item.availability_status || item.status || "Available",
          })),
        );
        setMasterData((cur) => ({
          ...cur,
          ...nextMasterSections,
          "waste-log": Array.isArray(wasteRes.data) ? wasteRes.data : [],
          "purchase-orders": Array.isArray(purchaseOrdersRes.data)
            ? purchaseOrdersRes.data
            : [],
          "stock-transfer": Array.isArray(transfersRes.data) ? transfersRes.data : [],
        }));
        setAuditReportRows(
          Array.isArray(auditReportRes.data) ? auditReportRes.data : []
        );
        setVendorInwards(Array.isArray(vendorInwardsRes.data) ? vendorInwardsRes.data : []);
        setVendorPayments(Array.isArray(vendorPaymentsRes.data) ? vendorPaymentsRes.data : []);
        setStockLedgerRows(Array.isArray(stockLedgerRes.data) ? stockLedgerRes.data : []);
        setConsumptionLogRows(Array.isArray(consumptionLogRes.data) ? consumptionLogRes.data : []);
        setStockFlowReportSummary(stockFlowRes.data?.summary || {
          opening: 0,
          received: 0,
          used: 0,
          remaining: 0,
          amount: 0,
        });
        setStockFlowReportRows(
          (Array.isArray(stockFlowRes.data?.rows) ? stockFlowRes.data.rows : []).map((row) => ({
            item: row.item,
            category: row.category || "",
            vendor: row.vendor || "—",
            openingQty: `${formatQuantity(row.openingQty)} ${row.unit || ""}`.trim(),
            receivedQty: `${formatQuantity(row.receivedQty)} ${row.unit || ""}`.trim(),
            usedQty: `${formatQuantity(row.usedQty)} ${row.unit || ""}`.trim(),
            remainingStock: `${formatQuantity(row.remainingQty)} ${row.unit || ""}`.trim(),
            unitRate: formatCurrency(row.unitRate),
            amount: formatCurrency(row.amount),
            reorderPoint: `${formatQuantity(row.reorderPoint)} ${row.unit || ""}`.trim(),
            store: row.store || "—",
            alert: row.alert || "OK",
          })),
        );
        setVendorInsights(vendorInsightsRes.data || { summary: {}, vendors: [] });
      } catch (err) {
        setItemsError(err.response?.data?.message || "Could not load inventory items.");
      } finally {
        setItemsLoading(false);
      }
    };
    load();
  }, []);

  // Persist master data to localStorage
  useEffect(() => {
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      if (API_BACKED_MASTER_SECTIONS.has(key)) return;
      setStoredValue(storageKey, JSON.stringify(masterData[key] || []));
    });
  }, [masterData]);

  const refreshInventoryItems = useCallback(async () => {
    const response = await API.get("/inventory");
    setInventoryItems(Array.isArray(response.data) ? response.data : []);
  }, []);

  const refreshWasteLogs = useCallback(async () => {
    const response = await API.get("/inventory/waste");
    setMasterData((cur) => ({
      ...cur,
      "waste-log": Array.isArray(response.data) ? response.data : [],
    }));
  }, []);

  const refreshPurchaseOrders = useCallback(async () => {
    const response = await API.get("/inventory/purchase-orders");
    setMasterData((cur) => ({
      ...cur,
      "purchase-orders": Array.isArray(response.data) ? response.data : [],
    }));
  }, []);

  const refreshTransfers = useCallback(async () => {
    const response = await API.get("/inventory/transfers");
    setMasterData((cur) => ({
      ...cur,
      "stock-transfer": Array.isArray(response.data) ? response.data : [],
    }));
  }, []);

  const refreshAuditReport = useCallback(async () => {
    const response = await API.get("/inventory/audit/report");
    setAuditReportRows(Array.isArray(response.data) ? response.data : []);
  }, []);

  const refreshVendorInsights = useCallback(async () => {
    const response = await API.get("/inventory/vendor-insights");
    setVendorInsights(response.data || { summary: {}, vendors: [] });
  }, []);

  const refreshVendorInwards = useCallback(async () => {
    const response = await API.get("/inventory/vendor-inwards");
    setVendorInwards(Array.isArray(response.data) ? response.data : []);
    await refreshVendorInsights();
  }, [refreshVendorInsights]);

  const refreshVendorPayments = useCallback(async () => {
    const response = await API.get("/inventory/vendor-payments");
    setVendorPayments(Array.isArray(response.data) ? response.data : []);
    await refreshVendorInsights();
  }, [refreshVendorInsights]);

  const refreshStockLedger = useCallback(async () => {
    const response = await API.get("/inventory/stock-ledger");
    setStockLedgerRows(Array.isArray(response.data) ? response.data : []);
  }, []);

  const refreshConsumptionLog = useCallback(async () => {
    const response = await API.get("/menu-recipes/consumption-log", {
      params: { limit: 500 },
    });
    setConsumptionLogRows(Array.isArray(response.data) ? response.data : []);
  }, []);

  const refreshStockFlowReport = useCallback(async (nextFilters = stockFlowFilters) => {
    const params = {};
    if (nextFilters?.dateFrom) params.dateFrom = nextFilters.dateFrom;
    if (nextFilters?.dateTo) params.dateTo = nextFilters.dateTo;

    const response = await API.get("/inventory/reports/stock-flow", { params });
    const payload = response.data || {};
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    setStockFlowReportSummary(payload.summary || {
      opening: 0,
      received: 0,
      used: 0,
      remaining: 0,
      amount: 0,
    });
    setStockFlowReportRows(rows.map((row) => ({
      item: row.item,
      category: row.category || "",
      vendor: row.vendor || "—",
      openingQty: `${formatQuantity(row.openingQty)} ${row.unit || ""}`.trim(),
      receivedQty: `${formatQuantity(row.receivedQty)} ${row.unit || ""}`.trim(),
      usedQty: `${formatQuantity(row.usedQty)} ${row.unit || ""}`.trim(),
      remainingStock: `${formatQuantity(row.remainingQty)} ${row.unit || ""}`.trim(),
      unitRate: formatCurrency(row.unitRate),
      amount: formatCurrency(row.amount),
      reorderPoint: `${formatQuantity(row.reorderPoint)} ${row.unit || ""}`.trim(),
      store: row.store || "—",
      alert: row.alert || "OK",
    })));
  }, [stockFlowFilters]);

  const refreshMasterSection = useCallback(async (sectionKey) => {
    const apiSectionKey = INVENTORY_MASTER_API_SECTION_MAP[sectionKey];
    if (!apiSectionKey) return;

    const records = await fetchInventoryMasterRecords(apiSectionKey);
    setMasterData((cur) => ({
      ...cur,
      [sectionKey]: records,
    }));
  }, []);

  useEffect(() => {
    refreshStockFlowReport(stockFlowFilters).catch(() => {
      setItemsError((current) => current || "Could not load stock flow report.");
    });
  }, [refreshStockFlowReport, stockFlowFilters]);

  // Reset form on section switch
  useEffect(() => {
    const section = INVENTORY_SECTIONS.find((s) => s.id === activeSection);
    if (!section) return;
    const fields = section.type === "master" ? MASTER_FIELDS[activeSection] || [] : [];
    setMasterDraft(buildInitialForm(fields));
    setEditingMasterId(null);
    if (section.type === "menu") {
      setMenuDraft(buildInitialForm(MENU_ITEM_FIELDS));
      setEditingMenuId(null);
    }
    setSectionSearch("");
  }, [activeSection]);

  useEffect(() => {
    const parentGroup = NAVIGATION_GROUPS.find((group) => group.ids.includes(activeSection));
    if (!parentGroup) return;
    setOpenNavGroup(parentGroup.label);
  }, [activeSection]);

  const categories = useMemo(
    () => [...new Set(inventoryItems.map((i) => i.category).filter(Boolean))].sort(),
    [inventoryItems]
  );

  const menuCategoryOptions = useMemo(() => {
    const optionMap = new Map();

    [
      ...PRESET_MENU_CATEGORY_OPTIONS,
      ...(masterData["menu-categories"] || []).map((item) => String(item.name || "").trim()),
      ...menuItemsData.map((item) => String(item.category || "").trim()),
      String(menuDraft.category || "").trim(),
    ]
      .filter(Boolean)
      .forEach((category) => {
        const key = category.toLowerCase();
        if (!optionMap.has(key)) {
          optionMap.set(key, category);
        }
      });

    return Array.from(optionMap.values()).sort((a, b) => a.localeCompare(b));
  }, [masterData, menuDraft.category, menuItemsData]);

  const totalStockValue = inventoryItems.reduce((s, i) => s + Number(i.stock || 0) * Number(i.price || 0), 0);
  const lowStockCount  = inventoryItems.filter(isLowStock).length;
  const expiredCount   = inventoryItems.filter((i) => i.expiry && new Date(i.expiry) <= new Date()).length;
  const expiringSoonRows = useMemo(
    () =>
      inventoryItems
        .filter((item) => {
          if (!item.expiry) return false;
          const status = getExpiryStatus(item.expiry);
          return status && status.label !== "Healthy";
        })
        .map((item) => {
          const status = getExpiryStatus(item.expiry);
          return {
            item: item.name,
            category: item.category,
            store: item.branch,
            stock: `${item.stock} ${item.unit}`,
            expiry: item.expiry ? String(item.expiry).split("T")[0] : "—",
            status: status?.label || "Healthy",
          };
        })
        .sort((a, b) => new Date(a.expiry || 0) - new Date(b.expiry || 0)),
    [inventoryItems],
  );
  const batchExpiryRows = useMemo(
    () =>
      (vendorInwards || [])
        .filter((row) => row.expiryDate || row.batchNo)
        .map((row) => {
          const status = getExpiryStatus(row.expiryDate);
          return {
            vendor: row.vendorName || "—",
            item: row.itemName || "—",
            batch: row.batchNo || "—",
            invoice: row.invoiceNo || "—",
            quantity: `${Number(row.quantityReceived || 0)} ${row.unit || ""}`.trim(),
            receivedDate: row.receivedDate || "—",
            expiry: row.expiryDate || "—",
            status: status?.label || "No Expiry",
          };
        })
        .sort((a, b) => new Date(a.expiry || 0) - new Date(b.expiry || 0)),
    [vendorInwards],
  );
  const activeGroupLabel = NAVIGATION_GROUPS.find((group) => group.ids.includes(activeSection))?.label || "Stock";
  const selectedSection = INVENTORY_SECTIONS.find((s) => s.id === activeSection);

  // ── Report rows ──────────────────────────────────────────
  const reportRows = useMemo(() => {
    const pi  = masterData["purchase-items"] || [];
    const ps  = masterData["purchase-services"] || [];
    const st  = masterData["stock-transfer"] || [];
    const vds = masterData.vendors || [];
    const inventoryByName = new Map(
      inventoryItems.map((item) => [String(item.name || "").trim().toLowerCase(), item]),
    );
    const latestVendorByItem = new Map();

    (vendorInwards || []).forEach((row) => {
      const key = String(row.itemName || "").trim().toLowerCase();
      if (!key) return;
      const current = latestVendorByItem.get(key);
      const currentDate = current?.sortDate ? new Date(current.sortDate) : new Date(0);
      const nextDate = row.receivedDate ? new Date(row.receivedDate) : new Date(0);
      if (!current || nextDate >= currentDate) {
        latestVendorByItem.set(key, {
          vendor: row.vendorName || "",
          receivedDate: row.receivedDate || "",
          sortDate: row.receivedDate || "",
        });
      }
    });

    pi.forEach((row) => {
      const key = String(row.itemName || "").trim().toLowerCase();
      if (!key || latestVendorByItem.has(key)) return;
      latestVendorByItem.set(key, {
        vendor: row.vendor || "",
        receivedDate: row.date || "",
        sortDate: row.date || "",
      });
    });
    const stockFlowByItem = new Map();

    (stockLedgerRows || []).forEach((row) => {
      const key = String(row.itemName || "").trim().toLowerCase();
      if (!key) return;
      const current = stockFlowByItem.get(key) || { receivedQty: 0, usedQty: 0 };
      const quantity = Number(row.quantity || 0);
      const direction = String(row.direction || "").toUpperCase();
      const referenceType = String(row.referenceType || "").toLowerCase();
      if (direction === "IN" && referenceType === "vendor_inward") {
        current.receivedQty += quantity;
      }
      if (direction === "OUT") {
        current.usedQty += quantity;
      }
      stockFlowByItem.set(key, current);
    });

    return {
      "vendor-report": vds.map((v) => {
        const vPurchases = pi.filter((p) => p.vendor === v.name);
        const vServices  = ps.filter((s) => s.vendor === v.name);
        return {
          name: v.name, contact: v.contact || "—",
          purchases: vPurchases.length, services: vServices.length,
          totalSpend: formatCurrency(
            vPurchases.reduce((s,r) => s + Number(r.amount||0), 0) +
            vServices.reduce((s,r) => s + Number(r.amount||0), 0)
          ),
          status: v.status || "—",
        };
      }),
      "stock-report": inventoryItems.map((i) => {
        const vendorMeta = latestVendorByItem.get(String(i.name || "").trim().toLowerCase());
        const stockFlow = stockFlowByItem.get(String(i.name || "").trim().toLowerCase()) || { receivedQty: 0, usedQty: 0 };
        return {
          item: i.name,
          category: i.category,
          vendor: vendorMeta?.vendor || "—",
          receivedQty: `${stockFlow.receivedQty} ${i.unit}`,
          usedQty: `${stockFlow.usedQty} ${i.unit}`,
          store: i.branch,
          stock: `${i.stock} ${i.unit}`,
          reorderPoint: `${i.reorderPoint || 10} ${i.unit}`,
          alert: isLowStock(i) ? "⚠ Low" : "OK",
          value: formatCurrency(Number(i.stock||0) * Number(i.price||0)),
        };
      }),
      "closing-stock-report": stockFlowReportRows.map((row) => ({
        item: row.item,
        branch: row.store || "—",
        opening: row.openingQty,
        issued: row.usedQty,
        closing: row.remainingStock,
      })),
      "item-report": inventoryItems.map((i) => ({
        item: i.name, category: i.category, unit: i.unit,
        rate: formatCurrency(i.price),
        expiry: i.expiry ? String(i.expiry).split("T")[0] : "—",
        status: isLowStock(i) ? "Low Stock" : "Normal",
      })),
      "expiring-soon-report": expiringSoonRows,
      "batch-expiry-report": batchExpiryRows,
      "item-consumption-report": Array.from(
        consumptionLogRows.reduce((map, row) => {
          const key = String(row.inventoryItemName || "").trim().toLowerCase();
          if (!key) return map;
          const itemMeta = inventoryByName.get(key);
          const current = map.get(key) || {
            item: row.inventoryItemName,
            consumedQty: 0,
            kitchen: itemMeta?.branch || "—",
            costValue: 0,
            unit: row.unit || itemMeta?.unit || "",
          };
          const consumedQty = Number(row.consumedQuantity || 0);
          current.consumedQty += consumedQty;
          current.costValue += consumedQty * Number(itemMeta?.price || 0);
          current.kitchen = itemMeta?.branch || current.kitchen || "—";
          current.unit = row.unit || itemMeta?.unit || current.unit || "";
          map.set(key, current);
          return map;
        }, new Map()).values(),
      ).map((row) => ({
        item: row.item,
        consumed: `${formatQuantity(row.consumedQty)} ${row.unit || ""}`.trim(),
        kitchen: row.kitchen,
        cost: formatCurrency(row.costValue),
      })),
      "total-consumption-report": Array.from(
        consumptionLogRows.reduce((map, row) => {
          const key = String(row.referenceType || "manual").trim() || "manual";
          const itemMeta = inventoryByName.get(String(row.inventoryItemName || "").trim().toLowerCase());
          const current = map.get(key) || {
            group: formatLabel(key),
            entries: 0,
            totalConsumedValue: 0,
            totalCostValue: 0,
          };
          const consumedQty = Number(row.consumedQuantity || 0);
          current.entries += 1;
          current.totalConsumedValue += consumedQty;
          current.totalCostValue += consumedQty * Number(itemMeta?.price || 0);
          map.set(key, current);
          return map;
        }, new Map()).values(),
      ).map((row) => ({
        group: row.group,
        entries: row.entries,
        totalConsumed: formatQuantity(row.totalConsumedValue),
        totalCost: formatCurrency(row.totalCostValue),
      })),
      "item-audit": auditReportRows.map((row) => ({
        item: row.itemName,
        auditDate: row.auditDate || "---",
        physicalStock: `${Number(row.physicalStock || 0)} ${row.unit || ""}`.trim(),
        systemStock: `${Number(row.systemStock || 0)} ${row.unit || ""}`.trim(),
        variance: `${Number(row.variance || 0) > 0 ? "+" : ""}${Number(row.variance || 0)} ${row.unit || ""}`.trim(),
        status: Number(row.variance || 0) === 0 ? "Matched" : "Review",
        remarks: row.remarks || "---",
      })),
    };
  }, [auditReportRows, batchExpiryRows, consumptionLogRows, expiringSoonRows, inventoryItems, masterData, stockFlowReportRows, stockLedgerRows, vendorInwards]);

  const reportConfig = {
    "vendor-report": { title:"Vendor Report", subtitle:"Purchase & service cost by vendor",
      columns:[{key:"name"},{key:"contact"},{key:"purchases"},{key:"services"},{key:"totalSpend"},{key:"status"}] },
    "stock-report": { title:"Stock Flow Report", subtitle:"Opening stock + received - used = remaining stock with real closing amount",
      columns:[{key:"item"},{key:"category"},{key:"vendor"},{key:"openingQty"},{key:"receivedQty"},{key:"usedQty"},{key:"remainingStock"},{key:"unitRate"},{key:"amount"},{key:"reorderPoint"},{key:"store"},{key:"alert"}] },
    "closing-stock-report": { title:"Closing Stock Report", subtitle:"Real opening, issued and closing quantities from stock flow",
      columns:[{key:"item"},{key:"branch"},{key:"opening"},{key:"issued"},{key:"closing"}] },
    "item-report": { title:"Item Report", subtitle:"Item details with rate and expiry",
      columns:[{key:"item"},{key:"category"},{key:"unit"},{key:"rate"},{key:"expiry"},{key:"status"}] },
    "expiring-soon-report": { title:"Expiring Soon Report", subtitle:"Items nearing expiry or already expired",
      columns:[{key:"item"},{key:"category"},{key:"store"},{key:"stock"},{key:"expiry"},{key:"status"}] },
    "batch-expiry-report": { title:"Batch-wise Expiry List", subtitle:"Received inward batches with invoice and expiry tracking",
      columns:[{key:"vendor"},{key:"item"},{key:"batch"},{key:"invoice"},{key:"quantity"},{key:"receivedDate"},{key:"expiry"},{key:"status"}] },
    "item-consumption-report": { title:"Item Consumption Report", subtitle:"Real consumption aggregated from recipe consumption logs",
      columns:[{key:"item"},{key:"consumed"},{key:"kitchen"},{key:"cost"}] },
    "total-consumption-report": { title:"Total Consumption Report", subtitle:"Combined real usage totals grouped by reference type",
      columns:[{key:"group"},{key:"entries"},{key:"totalConsumed"},{key:"totalCost"}] },
    "item-audit": { title:"Item Audit Report", subtitle:"Saved audit report from inventory backend",
      columns:[{key:"item"},{key:"auditDate"},{key:"physicalStock"},{key:"systemStock"},{key:"variance"},{key:"status"},{key:"remarks"}] },
  };

  // ── Master CRUD helpers ───────────────────────────────────
  const saveMasterRecord = useCallback(() => {
    const run = async () => {
      const isPoSection = activeSection === "purchase-orders";
      const isWasteSection = activeSection === "waste-log";
      const isTransferSection = activeSection === "stock-transfer";
      const inventoryMasterApiSection = INVENTORY_MASTER_API_SECTION_MAP[activeSection];
      const relevantFields = isPoSection
        ? PO_FIELDS
        : isWasteSection
          ? WASTE_FIELDS
          : (MASTER_FIELDS[activeSection] || []);

      const missing = relevantFields.some((f) => f.required && !String(masterDraft[f.key] ?? "").trim());
      if (missing) {
        alert("Please fill all required fields.");
        return false;
      }

      const payload = relevantFields.reduce((acc, f) => {
        acc[f.key] = masterDraft[f.key];
        return acc;
      }, {});

      if (isPoSection) {
        payload.quantity = Number(payload.quantity || 0);
        payload.rate = Number(payload.rate || 0);
      }
      if (isWasteSection || isTransferSection) {
        payload.quantity = Number(payload.quantity || 0);
      }

      try {
        if (isPoSection) {
          if (editingMasterId) {
            await API.put(`/inventory/purchase-orders/${editingMasterId}`, payload);
          } else {
            await API.post("/inventory/purchase-orders", payload);
          }
          await refreshPurchaseOrders();
        } else if (isWasteSection) {
          if (editingMasterId) {
            await API.put(`/inventory/waste/${editingMasterId}`, payload);
          } else {
            await API.post("/inventory/waste", payload);
          }
          await Promise.all([refreshWasteLogs(), refreshInventoryItems(), refreshStockLedger(), refreshStockFlowReport()]);
        } else if (isTransferSection) {
          if (editingMasterId) {
            await API.put(`/inventory/transfers/${editingMasterId}`, payload);
          } else {
            await API.post("/inventory/transfers", payload);
          }
          await Promise.all([refreshTransfers(), refreshStockLedger(), refreshStockFlowReport()]);
        } else if (inventoryMasterApiSection) {
          if (editingMasterId) {
            await updateInventoryMasterRecord(inventoryMasterApiSection, editingMasterId, payload);
          } else {
            await createInventoryMasterRecord(inventoryMasterApiSection, payload);
          }
          await refreshMasterSection(activeSection);
          if (activeSection === "vendors") {
            await refreshVendorInsights();
          }
        } else {
          setMasterData((cur) => {
            const list = cur[activeSection] || [];
            if (editingMasterId) {
              return {
                ...cur,
                [activeSection]: list.map((r) => r.id === editingMasterId ? { ...r, ...payload } : r),
              };
            }
            return { ...cur, [activeSection]: [...list, { id: Date.now(), ...payload }] };
          });
        }

        setMasterDraft(buildInitialForm(relevantFields));
        setEditingMasterId(null);
        return true;
      } catch (err) {
        alert(err.response?.data?.message || "Record could not be saved.");
        return false;
      }
    };

    return run();
  }, [
    activeSection,
    editingMasterId,
    masterDraft,
    refreshMasterSection,
    refreshPurchaseOrders,
    refreshStockFlowReport,
    refreshTransfers,
    refreshWasteLogs,
    refreshVendorInsights,
    refreshInventoryItems,
    refreshStockLedger,
  ]);

  const editMasterRecord = useCallback((record) => {
    if (!record) {
      setEditingMasterId(null);
      const fields = activeSection === "purchase-orders" ? PO_FIELDS :
        activeSection === "waste-log" ? WASTE_FIELDS :
        (MASTER_FIELDS[activeSection] || []);
      setMasterDraft(buildInitialForm(fields));
      return;
    }
    setEditingMasterId(record.id);
    setMasterDraft({ ...record });
  }, [activeSection]);

  const deleteMasterRecord = useCallback((id) => {
    const run = async () => {
      try {
        if (activeSection === "purchase-orders") {
          await API.delete(`/inventory/purchase-orders/${id}`);
          await refreshPurchaseOrders();
        } else if (activeSection === "waste-log") {
          await API.delete(`/inventory/waste/${id}`);
          await Promise.all([refreshWasteLogs(), refreshInventoryItems(), refreshStockLedger(), refreshStockFlowReport()]);
        } else if (activeSection === "stock-transfer") {
          await API.delete(`/inventory/transfers/${id}`);
          await Promise.all([refreshTransfers(), refreshStockLedger(), refreshStockFlowReport()]);
        } else if (INVENTORY_MASTER_API_SECTION_MAP[activeSection]) {
          await deleteInventoryMasterRecord(INVENTORY_MASTER_API_SECTION_MAP[activeSection], id);
          await refreshMasterSection(activeSection);
        } else {
          setMasterData((cur) => ({
            ...cur,
            [activeSection]: (cur[activeSection] || []).filter((r) => r.id !== id),
          }));
        }
      } catch (err) {
        alert(err.response?.data?.message || "Record could not be deleted.");
      }
    };

    run();
  }, [activeSection, refreshInventoryItems, refreshMasterSection, refreshPurchaseOrders, refreshStockFlowReport, refreshStockLedger, refreshTransfers, refreshWasteLogs]);

  const submitInventoryAudit = useCallback(async (entries) => {
    const payloadEntries = entries.map((entry) => ({
      itemId: entry.id,
      itemName: entry.name,
      systemStock: Number(entry.systemStock || 0),
      physicalStock: Number(entry.physicalStock || 0),
      variance: Number(entry.variance || 0),
      unit: entry.unit || "",
      remarks: entry.remarks || "",
    }));

    try {
      setIsSubmittingAudit(true);
      const response = await API.post("/inventory/audit", { entries: payloadEntries });
      await refreshAuditReport();
      alert(response.data?.message || "Audit submitted successfully.");
      return true;
    } catch (err) {
      alert(err.response?.data?.message || "Audit could not be submitted.");
      return false;
    } finally {
      setIsSubmittingAudit(false);
    }
  }, [refreshAuditReport]);

  const saveMenuItem = useCallback(() => {
    const run = async () => {
      const missing = MENU_ITEM_FIELDS.filter((field) => field.required).some((field) => {
        if (field.key === "imageFile") return false;
        return !String(menuDraft[field.key] ?? "").trim();
      });
      if (missing) {
        alert("Please fill all required menu item fields.");
        return false;
      }

      const formData = new FormData();
      formData.append("name", menuDraft.name || "");
      formData.append("category", menuDraft.category || "");
      formData.append("price", String(Number(menuDraft.price || 0)));
      formData.append("description", menuDraft.description || "");
      formData.append("foodType", menuDraft.foodType || "Veg");
      formData.append("status", menuDraft.status || "Available");
      formData.append("imageUrl", menuDraft.imageUrl || "");
      if (menuDraft.imageUrl) {
        formData.append("existingImageUrl", menuDraft.imageUrl);
      }
      if (menuDraft.imageFile instanceof File) {
        formData.append("image", menuDraft.imageFile);
      }

      try {
        let nextId = editingMenuId;
        if (editingMenuId) {
          await API.put(`/restaurant/menu/${editingMenuId}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          const response = await API.post("/restaurant/menu", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          nextId = response.data?.id || null;
        }

        const menuRes = await API.get("/restaurant/menu");
        const nextMenuItems = (Array.isArray(menuRes.data) ? menuRes.data : []).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category || "",
          price: Number(item.price || 0),
          imageUrl: item.image_url || item.imageUrl || "",
          description: item.description || "",
          foodType: item.food_type || item.foodType || "Veg",
          status: item.availability_status || item.status || "Available",
        }));
        setMenuItemsData(nextMenuItems);

        const normalizedCategory = String(menuDraft.category || "").trim();
        if (normalizedCategory) {
          const existingCategories = masterData["menu-categories"] || [];
          const hasCategory = existingCategories.some(
            (item) => String(item.name || "").trim().toLowerCase() === normalizedCategory.toLowerCase(),
          );
          if (!hasCategory) {
            await createInventoryMasterRecord("menu-categories", {
              name: normalizedCategory,
              parent: "Custom",
              status: "Active",
            });
            await refreshMasterSection("menu-categories");
          }
        }

        setMenuDraft(buildInitialForm(MENU_ITEM_FIELDS));
        setEditingMenuId(null);
        return true;
      } catch (err) {
        alert(err.response?.data?.message || "Menu item could not be saved.");
        return false;
      }
    };

    return run();
  }, [editingMenuId, masterData, menuDraft, refreshMasterSection]);

  const editMenuItem = useCallback((record) => {
    if (!record) {
      setEditingMenuId(null);
      setMenuDraft(buildInitialForm(MENU_ITEM_FIELDS));
      return;
    }
    setEditingMenuId(record.id);
    setMenuDraft({ ...buildInitialForm(MENU_ITEM_FIELDS), ...record, imageFile: null });
  }, []);

  const deleteMenuItem = useCallback((id) => {
    const run = async () => {
      try {
        await API.delete(`/restaurant/menu/${id}`);
        setMenuItemsData((cur) => cur.filter((item) => item.id !== id));
      } catch (err) {
        alert(err.response?.data?.message || "Menu item could not be deleted.");
      }
    };
    run();
  }, []);

  // ── Inventory items CRUD ──────────────────────────────────
  const saveInventoryItem = async () => {
    const missing = ITEMS_FORM.some((f) => f.required && !String(itemsForm[f.key] ?? "").trim());
    if (missing) { setItemsError("Please fill all required fields."); return false; }

    const payload = {
      ...itemsForm,
      stock: Number(itemsForm.stock),
      price: Number(itemsForm.price),
      reorderPoint: Number(itemsForm.reorderPoint || 10),
    };

    try {
      if (editingItemId) {
        await API.put(`/inventory/${editingItemId}`, payload);
      } else {
        await API.post("/inventory", payload);
      }
      await refreshInventoryItems();
      await refreshStockLedger();
      await refreshStockFlowReport();
      setItemsForm({ ...buildInitialForm(ITEMS_FORM), adjustmentReason: "" });
      setEditingItemId(null);
      setItemsError("");
      return true;
    } catch (err) {
      setItemsError(err.response?.data?.message || "Could not save item. Check role permissions.");
      return false;
    }
  };

  const deleteInventoryItem = async (id) => {
    try {
      await API.delete(`/inventory/${id}`);
      setInventoryItems((cur) => cur.filter((i) => i.id !== id));
      await Promise.all([refreshStockLedger(), refreshStockFlowReport()]);
    } catch (err) {
      setItemsError(err.response?.data?.message || "Could not delete item.");
    }
  };

  // ── Render section content ────────────────────────────────
  const renderContent = () => {
    if (!selectedSection) return null;

    if (selectedSection.type === "items") {
      return (
        <ItemsSection
          items={inventoryItems} vendorInwards={vendorInwards} stockLedgerRows={stockLedgerRows} masterData={masterData} form={itemsForm} setForm={setItemsForm}
          editingId={editingItemId} setEditingId={setEditingItemId}
          onSave={saveInventoryItem} onDelete={deleteInventoryItem}
          searchQuery={sectionSearch} setSearchQuery={setSectionSearch}
          categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
          categories={categories}
          summaryMetrics={{ totalItems: inventoryItems.length, totalStockValue, lowStockCount, expiredCount }}
          activeGroupLabel={activeGroupLabel}
          setOpenNavGroup={setOpenNavGroup}
          setActiveSection={setActiveSection}
        />
      );
    }

    if (selectedSection.type === "menu") {
      return (
        <MenuItemsSection
          records={menuItemsData}
          draft={menuDraft}
          setDraft={setMenuDraft}
          editingId={editingMenuId}
          onSave={saveMenuItem}
          onEdit={editMenuItem}
          onDelete={deleteMenuItem}
          searchQuery={sectionSearch}
          setSearchQuery={setSectionSearch}
          menuCategoryOptions={menuCategoryOptions}
        />
      );
    }

    if (selectedSection.type === "po") {
      return (
        <PurchaseOrderSection
          records={masterData["purchase-orders"] || []}
          onSave={saveMasterRecord} onEdit={editMasterRecord} onDelete={deleteMasterRecord}
          draft={masterDraft} setDraft={setMasterDraft} editingId={editingMasterId}
          searchQuery={sectionSearch} setSearchQuery={setSectionSearch}
          inventoryItems={inventoryItems}
          vendorInwards={vendorInwards}
          refreshVendorInwards={refreshVendorInwards}
          vendorPayments={vendorPayments}
          refreshVendorPayments={refreshVendorPayments}
          stockLedgerRows={stockLedgerRows}
          refreshStockLedger={refreshStockLedger}
          vendorInsights={vendorInsights}
          refreshInventoryItems={refreshInventoryItems}
          refreshPurchaseOrders={refreshPurchaseOrders}
          masterData={masterData}
          procurementOnly={procurementOnly}
        />
      );
    }

    if (selectedSection.type === "waste") {
      return (
        <WasteLogSection
          records={masterData["waste-log"] || []}
          onSave={saveMasterRecord} onEdit={editMasterRecord} onDelete={deleteMasterRecord}
          draft={masterDraft} setDraft={setMasterDraft} editingId={editingMasterId}
          searchQuery={sectionSearch} setSearchQuery={setSectionSearch}
          inventoryItems={inventoryItems}
          masterData={masterData}
        />
      );
    }

    if (selectedSection.type === "audit") {
      return (
        <StockAuditSection
          items={inventoryItems}
          onSubmit={submitInventoryAudit}
          isSubmitting={isSubmittingAudit}
        />
      );
    }

    if (selectedSection.type === "master") {
      return (
        <GenericMasterSection
          section={selectedSection}
          records={masterData[activeSection] || []}
          onSave={saveMasterRecord} onEdit={editMasterRecord} onDelete={deleteMasterRecord}
          draft={masterDraft} setDraft={setMasterDraft} editingId={editingMasterId}
          searchQuery={sectionSearch} setSearchQuery={setSectionSearch}
          setActiveSection={setActiveSection}
          vendorInsights={vendorInsights}
          masterData={masterData}
          vendorInwards={vendorInwards}
        />
      );
    }

    const cfg = reportConfig[activeSection];
    if (cfg) {
      const rows = activeSection === "stock-report"
        ? stockFlowReportRows
        : (reportRows[activeSection] || []);
      return (
        <ReportSection
          title={cfg.title}
          subtitle={cfg.subtitle}
          columns={cfg.columns}
          rows={rows}
          stockFlowSummary={activeSection === "stock-report" ? stockFlowReportSummary : null}
          stockFlowFilters={activeSection === "stock-report" ? stockFlowFilters : null}
          onStockFlowFilterChange={activeSection === "stock-report"
            ? (key, value) => setStockFlowFilters((current) => ({ ...current, [key]: value }))
            : null}
        />
      );
    }

    return null;
  };

  // ── Sidebar section groups ────────────────────────────────
  if (procurementOnly) {
    return (
      <div className="inventory-ui-scope min-h-screen bg-[linear-gradient(135deg,#f4f8ff_0%,#eef6f8_30%,#fff9f0_66%,#f8fafc_100%)] p-4 sm:p-5">
        <style>{INVENTORY_INTERNAL_CSS}</style>
        <div className="mx-auto max-w-[1800px] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div>
              <h2 className="text-[2.35rem] font-semibold text-slate-950">Real Procurement Flow</h2>
              <p className="mt-1 text-[18px] font-semibold text-slate-700">Vendor inward, payment tracking, and stock ledger on a dedicated workspace.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/inventory")}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Back To Inventory
            </button>
          </div>
          {itemsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-[0_10px_30px_rgba(239,68,68,0.08)]">
              {itemsError}
            </div>
          ) : null}
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-ui-scope min-h-screen bg-[linear-gradient(135deg,#f4f8ff_0%,#eef6f8_30%,#fff9f0_66%,#f8fafc_100%)] p-4 sm:p-5">
      <style>{INVENTORY_INTERNAL_CSS}</style>
      {/* Header */}
      {false ? (
      <div className="relative mb-6 overflow-hidden rounded-[30px] border border-slate-900/10 bg-[linear-gradient(120deg,#08203b_0%,#0f5562_42%,#245cc5_100%)] p-5 shadow-[0_26px_70px_rgba(15,23,42,0.16)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-8%] top-[-18%] h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[-6%] top-[12%] h-44 w-44 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:68px_68px] opacity-35" />
        </div>
        <div className="relative z-[1]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-[1.25rem] font-bold text-white md:text-4xl">Inventory Management</h1>
            <p className="mt-1.5 max-w-2xl text-lg text-slate-300">
              Full-stack inventory workspace — items, POs, waste logs, stock audits, inter-department transfers and reports.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Total Items",    v: inventoryItems.length,         c: "border-white/20 bg-white/10 text-white" },
              { l: "Stock Value",    v: formatCurrency(totalStockValue),c: "border-white/20 bg-white/10 text-white" },
              { l: "Low Stock",      v: lowStockCount,                  c: "border-amber-300/70 bg-amber-400/10 text-amber-100" },
              { l: "Expired",        v: expiredCount,                   c: "border-rose-300/60 bg-violet-500/15 text-rose-100" },
            ].map(({ l, v, c }) => (
              <div key={l} className={`rounded-2xl border px-4 py-3 ${c}`}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">{l}</p>
                <p className="mt-1 text-2xl font-bold">{itemsLoading && l === "Total Items" ? "..." : v}</p>
              </div>
            ))}
          </div>
        </div>

          {itemsError ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-base text-red-200">
              {itemsError}
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      <div className="space-y-5">
        <InventoryHeaderStrip
          summaryMetrics={{ totalItems: inventoryItems.length, totalStockValue, lowStockCount, expiredCount }}
          activeGroupLabel={activeGroupLabel}
          setOpenNavGroup={setOpenNavGroup}
          setActiveSection={setActiveSection}
        />
        {itemsError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-[0_10px_30px_rgba(239,68,68,0.08)]">
            {itemsError}
          </div>
        )}
        {openNavGroup ? (
          <div className="flex flex-wrap items-center gap-3 px-2">
            {(() => {
              const group = NAVIGATION_GROUPS.find((entry) => entry.label === openNavGroup);
              if (!group) return null;

              return group.ids.map((id) => {
                const sec = INVENTORY_SECTIONS.find((section) => section.id === id);
                if (!sec) return null;

                const Icon = sec.icon;
                const active = activeSection === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSection(id)}
                    className={`inline-flex min-h-[58px] cursor-pointer items-center gap-3 rounded-full border px-6 py-3.5 text-left text-[17px] font-semibold transition ${
                      active
                        ? "border-transparent bg-[linear-gradient(90deg,#2563eb_0%,#1d4ed8_100%)] text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]"
                        : "border-slate-200 bg-white/85 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                        active ? "bg-white/18 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="truncate whitespace-nowrap">{sec.label}</span>
                  </button>
                );
              }).concat(
                group.label === "Purchases"
                  ? [
                    <button
                      key="purchase-real-procurement-flow"
                      type="button"
                      onClick={() => navigate("/inventory/procurement")}
                      className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-slate-200 bg-white px-5 py-3 text-[16px] font-semibold text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <FaTruck size={14} />
                      Real Procurement Flow
                    </button>,
                  ]
                  : []
              );
            })()}
          </div>
        ) : null}

        {/* Main content */}
        <main className="min-w-0 space-y-5">
          {/* Mobile section picker */}
          {activeSection === "items" && <LowStockAlerts items={inventoryItems} />}

          {/* Section content */}
          <div>
            {itemsLoading && activeSection === "items" ? (
              <div className="flex items-center justify-center rounded-[28px] border border-white/70 bg-white/90 py-20 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
                  <p className="mt-3 text-base text-slate-400">Loading inventory...</p>
                </div>
              </div>
            ) : renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}


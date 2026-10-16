export const INVENTORY_MASTER_SECTIONS = [
  {
    key: "menu-categories",
    label: "Menu Categories",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "parent", label: "Parent", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
    columns: ["name", "parent", "status"],
  },
  {
    key: "segments",
    label: "Segments",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "description", label: "Description", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
    columns: ["name", "description", "status"],
  },
  {
    key: "vendors",
    label: "Vendors",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "contact", label: "Contact", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "gstin", label: "GSTIN", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Active", "On Hold", "Blacklisted"] },
    ],
    columns: ["name", "contact", "phone", "email", "city", "gstin", "status"],
  },
  {
    key: "units",
    label: "Units",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "shortName", label: "Short Name", type: "text", required: true },
      { key: "type", label: "Type", type: "select", options: ["Weight", "Volume", "Count"] },
    ],
    columns: ["name", "shortName", "type"],
  },
  {
    key: "locations",
    label: "Store / Kitchen",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "type", label: "Type", type: "select", required: true, options: ["Store", "Kitchen", "Bar", "Banquet"] },
      { key: "manager", label: "Manager", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
    ],
    columns: ["name", "type", "manager", "status"],
  },
  {
    key: "item-groups",
    label: "Item Groups",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "segment", label: "Segment", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
    columns: ["name", "segment", "status"],
  },
  {
    key: "ingredients",
    label: "Ingredients",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "group", label: "Group", type: "text" },
      { key: "unit", label: "Unit", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
    columns: ["name", "group", "unit", "status"],
  },
  {
    key: "purchase-items",
    label: "Purchase Items",
    fields: [
      { key: "itemName", label: "Item Name", type: "text", required: true },
      { key: "vendor", label: "Vendor", type: "text", required: true },
      { key: "quantity", label: "Quantity", type: "number", required: true },
      { key: "unit", label: "Unit", type: "text" },
      { key: "ratePerUnit", label: "Rate / Unit", type: "number" },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "invoiceNo", label: "Invoice No", type: "text" },
      { key: "date", label: "Purchase Date", type: "date", required: true },
    ],
    columns: ["itemName", "vendor", "quantity", "unit", "ratePerUnit", "amount", "invoiceNo", "date"],
  },
  {
    key: "purchase-services",
    label: "Purchase Services",
    fields: [
      { key: "serviceName", label: "Service Name", type: "text", required: true },
      { key: "vendor", label: "Vendor", type: "text", required: true },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "date", label: "Service Date", type: "date", required: true },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Completed", "Cancelled"] },
    ],
    columns: ["serviceName", "vendor", "amount", "date", "status"],
  },
];

export function buildInitialMasterForm(fields) {
  return fields.reduce((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});
}

import React, { useEffect, useMemo, useState } from "react";
import {
  fetchConsumptionLog,
  fetchRecipeCatalogue,
  fetchRecipeForMenuItem,
  fetchRecipeInventoryItems,
  fetchRecipeMenuItems,
  previewRecipeConsumption,
  saveRecipe,
} from "../../services/menuRecipeService";

const createEmptyRow = () => ({
  inventoryItemId: "",
  quantity: "",
  unit: "",
  wastagePercent: "0",
  isOptional: false,
  notes: "",
});

const formatNumber = (value, digits = 3) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return number.toFixed(digits).replace(/\.?0+$/, "");
};

export default function MenuRecipeManager() {
  const [menuItems, setMenuItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [consumptionLog, setConsumptionLog] = useState([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [recipeRows, setRecipeRows] = useState([createEmptyRow()]);
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [previewRows, setPreviewRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBaseData = async (preferredMenuItemId = null) => {
    setLoading(true);
    setError("");

    try {
      const [menuResponse, inventoryResponse, catalogueResponse, logResponse] = await Promise.all([
        fetchRecipeMenuItems(),
        fetchRecipeInventoryItems(),
        fetchRecipeCatalogue(),
        fetchConsumptionLog(10),
      ]);

      setMenuItems(menuResponse);
      setInventoryItems(inventoryResponse);
      setCatalogue(catalogueResponse);
      setConsumptionLog(logResponse);

      const fallbackMenuId = String(
        preferredMenuItemId ||
          menuResponse[0]?.id ||
          catalogueResponse[0]?.menuItemId ||
          "",
      );
      setSelectedMenuItemId((current) => current || fallbackMenuId);
    } catch (err) {
      setError(err.response?.data?.message || "Menu recipe module could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const loadRecipe = async (menuItemId) => {
    if (!menuItemId) {
      setRecipeRows([createEmptyRow()]);
      setPreviewRows([]);
      return;
    }

    try {
      setError("");
      const rows = await fetchRecipeForMenuItem(menuItemId);
      setRecipeRows(
        rows.length
          ? rows.map((row) => ({
              id: row.id,
              inventoryItemId: String(row.inventoryItemId || ""),
              quantity: String(row.quantity ?? ""),
              unit: row.unit || row.inventoryUnit || "",
              wastagePercent: String(row.wastagePercent ?? 0),
              isOptional: Boolean(row.isOptional),
              notes: row.notes || "",
              inventoryItemName: row.inventoryItemName || "",
              currentStock: row.currentStock,
            }))
          : [createEmptyRow()],
      );
      setPreviewRows([]);
    } catch (err) {
      setError(err.response?.data?.message || "Recipe rows could not be loaded.");
      setRecipeRows([createEmptyRow()]);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (!selectedMenuItemId) return;
    loadRecipe(selectedMenuItemId);
  }, [selectedMenuItemId]);

  const selectedMenuItem = useMemo(
    () => menuItems.find((item) => String(item.id) === String(selectedMenuItemId)) || null,
    [menuItems, selectedMenuItemId],
  );

  const recipeCountsByMenuItem = useMemo(
    () =>
      catalogue.reduce((acc, row) => {
        const key = String(row.menuItemId || "");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [catalogue],
  );

  const inventoryById = useMemo(
    () =>
      inventoryItems.reduce((acc, item) => {
        acc[String(item.id)] = item;
        return acc;
      }, {}),
    [inventoryItems],
  );

  const handleRowChange = (index, key, value) => {
    setRecipeRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        if (key === "inventoryItemId") {
          const selectedInventory = inventoryById[String(value)];
          return {
            ...row,
            inventoryItemId: value,
            unit: row.unit || selectedInventory?.unit || "",
            inventoryItemName: selectedInventory?.name || row.inventoryItemName,
          };
        }
        return { ...row, [key]: value };
      }),
    );
  };

  const addRecipeRow = () => {
    setRecipeRows((current) => [...current, createEmptyRow()]);
  };

  const removeRecipeRow = (index) => {
    setRecipeRows((current) => {
      if (current.length === 1) return [createEmptyRow()];
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const handleSave = async () => {
    if (!selectedMenuItemId) {
      setError("Menu item select karo.");
      return;
    }

    const payload = recipeRows
      .map((row, index) => ({
        inventoryItemId: Number(row.inventoryItemId || 0),
        quantity: Number(row.quantity || 0),
        unit: String(row.unit || "").trim(),
        wastagePercent: Number(row.wastagePercent || 0),
        isOptional: Boolean(row.isOptional),
        notes: String(row.notes || "").trim(),
        sortOrder: index,
      }))
      .filter((row) => row.inventoryItemId > 0 && row.quantity > 0);

    if (!payload.length) {
      setError("Kam se kam ek valid ingredient row add karo.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await saveRecipe(selectedMenuItemId, payload);
      await Promise.all([loadRecipe(selectedMenuItemId), loadBaseData(selectedMenuItemId)]);
      setNotice("Recipe save ho gayi.");
    } catch (err) {
      setError(err.response?.data?.message || "Recipe could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedMenuItemId) {
      setError("Preview ke liye menu item select karo.");
      return;
    }

    setPreviewLoading(true);
    setError("");

    try {
      const rows = await previewRecipeConsumption({
        menuItemId: Number(selectedMenuItemId),
        orderQuantity: Number(orderQuantity || 0),
      });
      setPreviewRows(rows);
    } catch (err) {
      setError(err.response?.data?.message || "Consumption preview nahi bana.");
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading menu recipe module...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Menu Recipe Manager</h2>
            <p className="mt-1 text-sm text-slate-500">
              Inventory ingredients ko menu items ke saath map karke per-order consumption preview kar sakte hain.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(260px,1fr)_120px]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Menu Item
              </span>
              <select
                value={selectedMenuItemId}
                onChange={(event) => setSelectedMenuItemId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">Select menu item</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.category ? `(${item.category})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Order Qty
              </span>
              <input
                type="number"
                min="1"
                value={orderQuantity}
                onChange={(event) => setOrderQuantity(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </div>

        {selectedMenuItem ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Category: {selectedMenuItem.category || "Uncategorized"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Price: Rs. {formatNumber(selectedMenuItem.price, 2)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              Status: {selectedMenuItem.status || "Available"}
            </span>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recipe Rows</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Quantity per serving define karo. Save karne par puri recipe replace hogi.
                </p>
              </div>

              <button
                type="button"
                onClick={addRecipeRow}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Add Row
              </button>
            </div>

            <div className="space-y-4">
              {recipeRows.map((row, index) => {
                const linkedInventory = inventoryById[String(row.inventoryItemId)];

                return (
                  <div
                    key={`${row.id || "new"}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(180px,1.5fr)_110px_110px_120px]">
                      <label>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Ingredient
                        </span>
                        <select
                          value={row.inventoryItemId}
                          onChange={(event) =>
                            handleRowChange(index, "inventoryItemId", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        >
                          <option value="">Select ingredient</option>
                          {inventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({formatNumber(item.stock)} {item.unit || "unit"})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={row.quantity}
                          onChange={(event) => handleRowChange(index, "quantity", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Unit
                        </span>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(event) => handleRowChange(index, "unit", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Wastage %
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={row.wastagePercent}
                          onChange={(event) =>
                            handleRowChange(index, "wastagePercent", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
                      <label>
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Notes
                        </span>
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(event) => handleRowChange(index, "notes", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                          placeholder="Optional prep note"
                        />
                      </label>

                      <label className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <input
                          type="checkbox"
                          checked={row.isOptional}
                          onChange={(event) =>
                            handleRowChange(index, "isOptional", event.target.checked)
                          }
                        />
                        <span className="text-sm font-medium text-slate-700">Optional item</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeRecipeRow(index)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700"
                      >
                        Remove
                      </button>
                    </div>

                    {linkedInventory ? (
                      <div className="mt-3 text-xs text-slate-500">
                        Current stock: {formatNumber(linkedInventory.stock)} {linkedInventory.unit || row.unit || "unit"}
                        {linkedInventory.branch ? ` | Branch: ${linkedInventory.branch}` : ""}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Recipe"}
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading}
                className="rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-medium text-sky-700 disabled:opacity-60"
              >
                {previewLoading ? "Previewing..." : "Preview Consumption"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Consumption Preview</h3>
              <p className="mt-1 text-sm text-slate-500">
                Selected order quantity ke hisaab se kitna stock consume hoga.
              </p>
            </div>

            {!previewRows.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                Preview run karne par stock impact yahan dikhega.
              </div>
            ) : (
              <div className="space-y-3">
                {previewRows.map((row) => (
                  <div
                    key={`${row.recipeRowId}-${row.inventoryItemId}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{row.inventoryItemName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Required {formatNumber(row.requiredQuantity)} {row.unit || "unit"} | Current{" "}
                          {formatNumber(row.currentStock)} {row.unit || "unit"}
                        </div>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          row.enoughStock
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {row.enoughStock ? "Enough stock" : "Low stock"}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Remaining after use: {formatNumber(row.remainingStock)} {row.unit || "unit"}
                      {row.notes ? ` | ${row.notes}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Recipe Catalogue</h3>
              <p className="mt-1 text-sm text-slate-500">
                Existing saved recipes ka quick overview.
              </p>
            </div>

            <div className="space-y-3">
              {menuItems.length ? (
                menuItems.map((item) => {
                  const rowCount = recipeCountsByMenuItem[String(item.id)] || 0;
                  const isSelected = String(item.id) === String(selectedMenuItemId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMenuItemId(String(item.id))}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{item.name}</div>
                        <div className={`mt-1 text-xs ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                          {item.category || "Uncategorized"}
                        </div>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isSelected ? "bg-white/15 text-white" : "bg-white text-slate-600"
                        }`}
                      >
                        {rowCount} rows
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                  No menu items found.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Recent Consumption</h3>
              <p className="mt-1 text-sm text-slate-500">
                Last 10 inventory consumption logs.
              </p>
            </div>

            <div className="space-y-3">
              {consumptionLog.length ? (
                consumptionLog.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{row.menuItemName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.inventoryItemName} consumed {formatNumber(row.consumedQuantity)} {row.unit || "unit"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Ref: {row.referenceType || "manual"}
                      {row.referenceId ? ` / ${row.referenceId}` : ""}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                  Consumption log empty hai.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

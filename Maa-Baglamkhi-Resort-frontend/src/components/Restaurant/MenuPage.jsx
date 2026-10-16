import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import RestaurantContext from "../../Context/restaurantContext";
import API, { getBackendBaseURL } from "../../api";
import { restaurantService } from "../../services/restaurantService";
import { getCurrentActor } from "../../utils/currentActor";
import { showKOTToast } from "../../utils/printKOT";

const normalizeCategory = (value) => (value || "Other").trim().toLowerCase();
const normalizeItemName = (value) => String(value || "").trim().toLowerCase();

const pickPreferredMenuItem = (current, candidate) => {
  const currentCategory = normalizeCategory(current?.category);
  const candidateCategory = normalizeCategory(candidate?.category);
  const currentScore =
    (currentCategory !== "other" ? 2 : 0) +
    (current?.image_url || current?.imageUrl ? 1 : 0);
  const candidateScore =
    (candidateCategory !== "other" ? 2 : 0) +
    (candidate?.image_url || candidate?.imageUrl ? 1 : 0);

  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }

  return Number(candidate?.id || 0) > Number(current?.id || 0) ? candidate : current;
};

const normalizeOrderItem = (item) => {
  const qty = Number(item?.qty || item?.quantity || 0);
  const rate = Number(item?.rate || item?.price || 0);
  const amount = Number(item?.amount ?? qty * rate);
  const taxAmount = Number(item?.taxAmount || 0);
  const total = Number(item?.total ?? amount + taxAmount);

  return {
    ...item,
    qty,
    rate,
    amount,
    taxAmount,
    total,
  };
};

const getOrderItemKey = (item) =>
  String(item?.menuItemId || item?.id || `${item?.name || ""}-${item?.rate || item?.price || 0}`);

const createOrderEntry = (item, quantity, taxValue) => {
  const effectivePriceValue =
    item.effectivePrice ?? item.effective_price ?? item.price ?? item.rate ?? 0;
  const effectiveRate = Number(effectivePriceValue);
  const qty = Number(quantity || 0);
  const amount = effectiveRate * qty;
  const taxPercent = Number(taxValue ?? item.tax ?? 5);
  const taxAmount = (amount * taxPercent) / 100;

  return {
    id: item.id || Date.now(),
    menuItemId: item.menuItemId || item.id || null,
    name: item.name,
    qty,
    rate: effectiveRate,
    baseRate: Number(item.price ?? item.baseRate ?? item.rate ?? 0),
    amount,
    taxAmount,
    total: amount + taxAmount,
    category: item.category || "Other",
    tax: taxPercent,
  };
};

const buildMenuPlaceholder = (item) => {
  const category = (item?.category || "Menu").trim();
  const name = (item?.name || category).trim();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "MI";

  return {
    initials,
    category,
  };
};

const MENU_ITEMS_PAGE_SIZE = 24;

const MenuPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { table } = useParams();
  const banquetMenuPicker = Boolean(location.state?.banquetMenuPicker);
  const banquetReturnPath = location.state?.returnTo || "/banquet";
  const entityType = location.state?.entityType || "Table";
  const roomData = location.state?.roomData || null;
  const { menuItems, setSelectedTable } = useContext(RestaurantContext);
  const actor = getCurrentActor();
 const waiterName = actor?.name || (entityType === "Room" ? "Room Service" : "Waiter");

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [qty, setQty] = useState({});
  const [order, setOrder] = useState(
    Array.isArray(location.state?.existingItems)
      ? location.state.existingItems.map(normalizeOrderItem)
      : [],
  );
  const [menu, setMenu] = useState(menuItems);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [menuError, setMenuError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taxByItem, setTaxByItem] = useState({});
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(20);
  const [quickAddQuery, setQuickAddQuery] = useState("");
  const [quickAddQty, setQuickAddQty] = useState("1");
  const [quickAddItemId, setQuickAddItemId] = useState("");
  const [showQuickAddSuggestions, setShowQuickAddSuggestions] = useState(false);
  const [menuPage, setMenuPage] = useState(1);
  const [brokenImageIds, setBrokenImageIds] = useState(() => new Set());

  useEffect(() => {
    if (banquetMenuPicker) return;
    setSelectedTable(table);
    setSelectedCategory("All");
  }, [banquetMenuPicker, setSelectedTable, table]);

  useEffect(() => {
    let mounted = true;
    const loadMenu = async () => {
      setIsLoadingMenu(true);
      setMenuError(null);
      try {
        const data = banquetMenuPicker
          ? (await API.get("/restaurant/menu")).data
          : await restaurantService.getMenu(table);
        if (mounted) setMenu(data || []);
      } catch (err) {
        if (mounted) {
          setMenu([]);
          setMenuError(err.response?.data?.message || "Unable to load menu.");
        }
      } finally {
        if (mounted) setIsLoadingMenu(false);
      }
    };
    loadMenu();
    return () => {
      mounted = false;
    };
  }, [banquetMenuPicker, table]);

  useEffect(() => {
    if (banquetMenuPicker) return;
    setMenu(menuItems);
  }, [banquetMenuPicker, menuItems]);

  const visibleMenu = useMemo(() => {
    const deduped = new Map();

    (Array.isArray(menu) ? menu : []).forEach((item) => {
      const key = normalizeItemName(item?.name);
      if (!key) return;

      if (!deduped.has(key)) {
        deduped.set(key, item);
        return;
      }

      deduped.set(key, pickPreferredMenuItem(deduped.get(key), item));
    });

    return Array.from(deduped.values());
  }, [menu]);

  const categories = useMemo(() => {
    const set = new Map();
    visibleMenu.forEach((item) => {
      const label = (item.category || "Other").trim() || "Other";
      const key = normalizeCategory(label);
      if (!set.has(key)) set.set(key, label);
    });
    return ["All", ...Array.from(set.values())];
  }, [visibleMenu]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") return visibleMenu;
    return visibleMenu.filter(
      (item) => normalizeCategory(item.category) === normalizeCategory(selectedCategory),
    );
  }, [visibleMenu, selectedCategory]);

  const totalMenuPages = Math.max(1, Math.ceil(filteredItems.length / MENU_ITEMS_PAGE_SIZE));
  const paginatedMenuItems = filteredItems.slice(
    (menuPage - 1) * MENU_ITEMS_PAGE_SIZE,
    menuPage * MENU_ITEMS_PAGE_SIZE,
  );

  useEffect(() => {
    setMenuPage(1);
  }, [selectedCategory, visibleMenu]);

  useEffect(() => {
    if (menuPage > totalMenuPages) {
      setMenuPage(totalMenuPages);
    }
  }, [menuPage, totalMenuPages]);

  const quickAddMatches = useMemo(() => {
    const query = quickAddQuery.trim().toLowerCase();
    if (!query) return visibleMenu.slice(0, 8);
    return visibleMenu
      .filter((item) => {
        const name = String(item?.name || "").toLowerCase();
        const category = String(item?.category || "").toLowerCase();
        return name.includes(query) || category.includes(query);
      })
      .slice(0, 8);
  }, [quickAddQuery, visibleMenu]);

  const handleQtyChange = (id, value) => {
    setQty((prev) => ({ ...prev, [id]: value }));
  };

  const handleAdd = (item, quantityOverride = null) => {
    const quantity = Number((quantityOverride ?? qty[item.id]) || 0);
    if (quantity <= 0) return;
    const taxValue = taxByItem[item.id] ?? item.tax ?? 5;
    setOrder((prev) => {
      const existingIndex = prev.findIndex(
        (entry) =>
          String(entry.menuItemId || entry.id) === String(item.id) &&
          Number(entry.rate || 0) === Number(item.effectivePrice ?? item.effective_price ?? item.price ?? 0),
      );

      if (existingIndex === -1) {
        return [...prev, createOrderEntry(item, quantity, taxValue)];
      }

      return prev.map((entry, index) =>
        index === existingIndex
          ? createOrderEntry(
              {
                ...item,
                id: entry.id,
                menuItemId: entry.menuItemId || item.id,
              },
              Number(entry.qty || 0) + quantity,
              entry.tax ?? taxValue,
            )
          : entry,
      );
    });
    setQty((prev) => ({ ...prev, [item.id]: "" }));
  };

  const handleQuickAdd = () => {
    const normalizedQuery = quickAddQuery.trim().toLowerCase();
    const selectedItem =
      visibleMenu.find((item) => String(item.id) === String(quickAddItemId)) ||
      visibleMenu.find((item) => String(item.name || "").trim().toLowerCase() === normalizedQuery) ||
      quickAddMatches[0];
    const quantity = Math.max(1, Number(quickAddQty || 1));

    if (!selectedItem) {
      alert("Item search karke select karo.");
      return;
    }

    handleAdd(selectedItem, quantity);
    setQuickAddQuery("");
    setQuickAddQty("1");
    setQuickAddItemId("");
  };

  const handleTaxChange = (itemId, value) => {
    setTaxByItem((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleOrderQtyAdjust = (orderItem, delta) => {
    setOrder((prev) =>
      prev.flatMap((entry) => {
        if (getOrderItemKey(entry) !== getOrderItemKey(orderItem)) {
          return [entry];
        }

        const nextQty = Number(entry.qty || 0) + delta;
        if (nextQty <= 0) {
          return [];
        }

        return [
          createOrderEntry(
            {
              ...entry,
              id: entry.id,
              menuItemId: entry.menuItemId,
              price: entry.baseRate ?? entry.rate,
            },
            nextQty,
            entry.tax,
          ),
        ];
      }),
    );
  };

  const handleOrderItemRemove = (orderItem) => {
    setOrder((prev) => prev.filter((entry) => getOrderItemKey(entry) !== getOrderItemKey(orderItem)));
  };

  const buildMenuImageSrc = (imagePath) => {
    const trimmedPath = String(imagePath || "").trim();
    if (!trimmedPath) return "";
    if (/^https?:\/\//i.test(trimmedPath) || trimmedPath.startsWith("data:")) return trimmedPath;

    const backendBase = String(getBackendBaseURL() || "").replace(/\/+$/, "");
    const normalizedPath = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
    return `${backendBase}${normalizedPath}`;
  };

  const markImageBroken = (itemId) => {
    setBrokenImageIds((current) => {
      if (current.has(itemId)) return current;
      const next = new Set(current);
      next.add(itemId);
      return next;
    });
  };

  const subtotal = order.reduce((sum, item) => sum + item.amount, 0);
  const taxTotal = order.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = subtotal + taxTotal;

  const handleSubmit = async () => {
    if (!order.length) return alert("Please add items");

    if (banquetMenuPicker) {
      const selectedRestaurantMenuItems = order.map((item) => ({
        name: item.name,
        qty: Number(item.qty || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        taxAmount: Number(item.taxAmount || 0),
        total: Number(item.total || 0),
      }));
      const selectedCustomMenuItems = Array.from(
        new Set(selectedRestaurantMenuItems.map((item) => item.name).filter(Boolean)),
      );
      navigate(banquetReturnPath, {
        state: {
          banquetMenuSelection: {
            selectedCustomMenuItems,
            selectedRestaurantMenuItems,
          },
        },
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      let tokenId = null;
      try {
        const tokenRes = await API.get(`/token/table/${table}`);
        tokenId = tokenRes.data?.id || null;
      } catch {
        tokenId = null;
      }
      if (!tokenId) {
        const createRes = await API.post("/token/create", { tableNumber: String(table), waiter: waiterName });
        tokenId = createRes.data?.tokenId;
      }
      if (tokenId) {
        await Promise.all(
          order.map((item) => API.post("/token/item", { tokenId, name: item.name, qty: item.qty, rate: item.rate })),
        );
      }
      await restaurantService.createOrder(
        table,
        order.map(({ name, qty: quantity, rate: price }) => ({ name, quantity, price })),
      );
      localStorage.setItem(`entityType:${table}`, entityType);

      console.log("[MenuPage] Creating kitchen order...");
      const kitchenResult = await restaurantService.createKitchenOrder({
        table,
        waiter: waiterName,
        entityType,
        referenceType: entityType === "Room" ? "room" : "table",
        bookingId: entityType === "Room" ? (location.state?.bookingId || 0) : (location.state?.bookingId || 0),
        prepTimeMinutes,
        items: order.map(({ name, qty: quantity, rate: price }) => ({ name, quantity, price })),
      });
      console.log("[MenuPage] Kitchen order created:", kitchenResult);

      // Backend (ThermalPrintService) silently prints the KOT on the kitchen
      // printer directly — no browser print dialog needed from the frontend.
      // We just show a small confirmation message popup instead.
      try {
        showKOTToast({ table, entityType, variant: "success" });
      } catch (toastErr) {
        console.warn("[MenuPage] KOT toast failed:", toastErr);
      }

      window.dispatchEvent(new Event("kitchenUpdated"));
      window.dispatchEvent(new Event("tokenUpdated"));
      navigate(`/restaurant/edit-token/${table}`, { state: { items: order, entityType, roomData } });
      setOrder([]);
    } catch (err) {
      console.error("[MenuPage] Submit error:", err);
      setSubmitError(err.response?.data?.message || "Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dashboardTitle = banquetMenuPicker
    ? "Select Restaurant Menu For Banquet"
    : `${entityType === "Room" ? "Room" : "Table"} ${table} Menu Dashboard`;

  const dashboardSubtitle = banquetMenuPicker
    ? "Items select karke seedha banquet reservation form mein wapas laut sakte hain."
    : roomData
    ? `${roomData.categoryName || "Room"} | ID ${roomData.roomId || "--"}`
    : "Category-wise item selection";

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-slate-50 to-blue-50 p-3 sm:p-4 lg:p-6">
      <div className="w-full min-w-0">
        {/* Hero */}
        <div className="relative mb-4 overflow-hidden rounded-[18px] bg-[linear-gradient(120deg,#172554_0%,#1D4ED8_55%,#0EA5E9_100%)] px-4 py-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:mb-6 sm:rounded-[24px] sm:px-6 sm:py-6 md:rounded-[30px] md:px-8 md:py-8 lg:px-8 lg:py-8">
          {/* Abstract wave / light pattern */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
            viewBox="0 0 1200 400"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,300 C250,220 350,380 600,300 C850,220 950,380 1200,300 L1200,400 L0,400 Z" fill="rgba(255,255,255,0.10)" />
            <path d="M0,340 C300,260 400,400 700,330 C900,280 1000,360 1200,320 L1200,400 L0,400 Z" fill="rgba(255,255,255,0.08)" />
            <circle cx="1080" cy="70" r="140" fill="rgba(255,255,255,0.06)" />
            <circle cx="120" cy="40" r="90" fill="rgba(255,255,255,0.05)" />
          </svg>

          <div className="relative flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200 sm:text-[13px] sm:tracking-[0.28em]">
                {banquetMenuPicker ? "Banquet Menu Picker" : "Restaurant Menu Card"}
              </div>
              <div className="mt-2 break-words text-xl font-black leading-tight sm:text-2xl md:text-3xl lg:text-4xl">
                {dashboardTitle}
              </div>
              <div className="mt-2 break-words text-base text-white/85 sm:text-lg lg:text-xl">
                {dashboardSubtitle}
              </div>
              {!banquetMenuPicker ? (
                <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold text-white/90 backdrop-blur-md sm:mt-4 sm:gap-2.5 sm:px-4 sm:py-2 sm:text-base">
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-sky-100 sm:px-3 sm:text-sm sm:tracking-[0.16em]">
                    {entityType}
                  </span>
                  <span className="truncate">Active service for {entityType === "Room" ? "room" : "table"} {table}</span>
                </div>
              ) : null}
            </div>

            {!banquetMenuPicker ? (
              <div className="w-full rounded-[18px] border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:rounded-[24px] sm:p-5 xl:max-w-[640px]">
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-sky-100 sm:text-sm sm:tracking-[0.2em]">
                  Quick Add Item
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.9fr)_130px_150px]">
                  <div className="relative min-w-0">
                    <input
                      type="text"
                      value={quickAddQuery}
                      onFocus={() => setShowQuickAddSuggestions(true)}
                      onBlur={() => {
                        window.setTimeout(() => setShowQuickAddSuggestions(false), 120);
                      }}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setQuickAddQuery(nextValue);
                        const matchedItem = visibleMenu.find(
                          (item) => String(item.name || "").trim().toLowerCase() === nextValue.trim().toLowerCase(),
                        );
                        setQuickAddItemId(matchedItem ? String(matchedItem.id) : "");
                      }}
                      placeholder="Search item or category"
                      className="h-12 w-full min-w-0 rounded-2xl border border-white/20 bg-white px-4 text-base font-medium text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-sky-300 sm:text-lg"
                    />
                    {showQuickAddSuggestions && quickAddMatches.length ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                        <div className="max-h-56 overflow-y-auto py-1">
                          {quickAddMatches.map((item) => {
                            const effectivePrice = Number(
                              item.effectivePrice ?? item.effective_price ?? item.price ?? 0,
                            );
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setQuickAddQuery(item.name || "");
                                  setQuickAddItemId(String(item.id));
                                  setShowQuickAddSuggestions(false);
                                }}
                                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-base text-slate-700 transition hover:bg-blue-50"
                              >
                                <span className="truncate font-semibold text-slate-900">{item.name}</span>
                                <span className="shrink-0 text-sm font-bold text-slate-500">
                                  Rs. {effectivePrice}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <input
                    type="number"
                    min="1"
                    value={quickAddQty}
                    onChange={(event) => setQuickAddQty(event.target.value.replace(/\D/g, "").slice(0, 2) || "1")}
                    className="h-12 w-full min-w-0 rounded-2xl border border-white/20 bg-white px-4 text-base font-bold text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-sky-300 sm:text-lg lg:w-auto"
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    className="h-12 w-full min-w-0 rounded-2xl bg-white px-4 text-base font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:text-lg lg:w-auto"
                  >
                    Add Item
                  </button>
                </div>
                <div className="mt-2.5 flex items-center justify-start">
                  <span className="text-sm text-white/75">
                    Fast add without opening the full side panel.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Menu Items */}
          <div className="min-w-0 rounded-[18px] border border-blue-100 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.06)] sm:rounded-[24px] sm:p-5 lg:p-6">
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <div className="text-xl font-black leading-none text-slate-900 sm:text-2xl lg:text-[30px]">Menu Items</div>
              <div className="text-sm font-semibold text-slate-400 sm:text-base">
                {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
              </div>
            </div>

            {isLoadingMenu ? <div className="p-6 text-center text-lg text-slate-500 sm:text-xl">Loading menu...</div> : null}
            {menuError ? <div className="p-6 text-center text-lg text-rose-600 sm:text-xl">{menuError}</div> : null}
            {!isLoadingMenu && !menuError && !filteredItems.length ? (
              <div className="p-6 text-center text-lg text-slate-500 sm:text-xl">No items in this category.</div>
            ) : null}

            {!isLoadingMenu && !menuError && filteredItems.length ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
                {paginatedMenuItems.map((item) => {
                  const effectivePrice = Number(
                    item.effectivePrice ?? item.effective_price ?? item.price ?? 0,
                  );
                  const itemImageSrc = buildMenuImageSrc(item.image_url || item.imageUrl);
                  const showImage = Boolean(itemImageSrc) && !brokenImageIds.has(item.id);
                  const placeholder = buildMenuPlaceholder(item);
                  const currentTax = Number(taxByItem[item.id] ?? item.tax ?? 5);
                  const currentQty = Number(qty[item.id] || 0);
                  const adjustTax = (delta) => {
                    const next = Math.max(0, Math.round((currentTax + delta) * 100) / 100);
                    handleTaxChange(item.id, next);
                  };
                  const decrementQty = () => {
                    const next = Math.max(0, currentQty - 1);
                    handleQtyChange(item.id, next > 0 ? String(next) : "");
                  };
                  const incrementQty = () => {
                    handleQtyChange(item.id, String(currentQty + 1));
                  };
                  return (
                    <div
                      key={item.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:rounded-2xl"
                    >
                      {/* Image strip on top — keeps the card a compact rectangle */}
                      <div className="relative h-24 w-full shrink-0 overflow-hidden bg-slate-100 sm:h-28">
                        {showImage ? (
                          <img
                            src={itemImageSrc}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                            onError={() => markImageBroken(item.id)}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 to-blue-100">
                            <span className="text-lg font-black text-blue-600 sm:text-xl">
                              {placeholder.initials}
                            </span>
                          </div>
                        )}
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 shadow-sm sm:text-[10px]">
                          {placeholder.category}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col gap-1.5 p-2 sm:p-2.5">
                        <div className="min-w-0">
                          <div
                            className="truncate text-[12px] font-bold leading-tight text-slate-900 sm:text-[13px]"
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div className="mt-0.5 text-[13px] font-extrabold text-emerald-600 sm:text-[14px]">
                            Rs. {item.price}
                          </div>
                        </div>

                        {/* Tax stepper — compact single row */}
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => adjustTax(-0.5)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-bold text-slate-600 hover:bg-slate-200"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={taxByItem[item.id] ?? item.tax ?? 5}
                            onChange={(e) => handleTaxChange(item.id, e.target.value)}
                            className="h-6 w-full min-w-0 bg-transparent text-center text-[11px] font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            title="Tax %"
                          />
                          <button
                            type="button"
                            onClick={() => adjustTax(0.5)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[13px] font-bold text-slate-600 hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>

                        {/* Qty stepper + Add row — aligned in one row, equal heights */}
                        <div className="mt-auto flex items-center gap-1.5">
                          <div className="flex h-8 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              onClick={decrementQty}
                              disabled={currentQty <= 0}
                              className="flex h-full w-7 shrink-0 items-center justify-center text-[14px] font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={qty[item.id] || ""}
                              onChange={(e) => handleQtyChange(item.id, e.target.value)}
                              placeholder="0"
                              className="h-full w-9 min-w-0 border-x border-slate-200 bg-white text-center text-[12px] font-semibold outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={incrementQty}
                              className="flex h-full w-7 shrink-0 items-center justify-center text-[14px] font-bold text-slate-600 transition hover:bg-slate-200"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => handleAdd(item)}
                            className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 text-[12px] font-bold text-white transition hover:bg-blue-700"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)" />
                              <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!isLoadingMenu && !menuError && filteredItems.length > MENU_ITEMS_PAGE_SIZE ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-4 sm:mt-6 sm:gap-4 sm:pt-5">
                <button
                  type="button"
                  onClick={() => setMenuPage((current) => Math.max(1, current - 1))}
                  disabled={menuPage === 1}
                  className="flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
                >
                  <span aria-hidden="true">‹</span> Previous
                </button>
                <div className="text-sm text-slate-500 sm:text-base">
                  Page <span className="font-bold text-slate-900">{menuPage}</span> of{" "}
                  <span className="font-bold text-slate-900">{totalMenuPages}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuPage((current) => Math.min(totalMenuPages, current + 1))}
                  disabled={menuPage === totalMenuPages}
                  className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
                >
                  Next <span aria-hidden="true">›</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Right Sidebar */}
          <div className="min-w-0 space-y-4 sm:space-y-5">
            {/* Categories */}
            <div className="min-w-0 rounded-[18px] border border-blue-100 bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-5">
              <div className="mb-3 text-xl font-black text-slate-900 sm:mb-4 sm:text-2xl">Categories</div>
              <div className="max-h-[320px] space-y-2 overflow-auto pr-1 sm:space-y-2.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left text-base font-bold transition sm:px-4 sm:py-3.5 sm:text-lg ${
                      selectedCategory === cat
                        ? "border-blue-700 bg-blue-700 text-white shadow-md"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    <span className="min-w-0 truncate">{cat}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${
                        selectedCategory === cat ? "bg-white/20" : "bg-white text-slate-500"
                      }`}
                    >
                      {cat === "All" ? menu.length : filteredItems.filter((item) => normalizeCategory(item.category) === normalizeCategory(cat)).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="min-w-0 rounded-[18px] border border-blue-100 bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-5">
              <div className="mb-3 text-xl font-black text-slate-900 sm:mb-4 sm:text-2xl">Order Summary</div>
              <div className="max-h-[260px] overflow-auto pr-1">
                {order.map((item) => {
                  const itemTotal = Number(item.total ?? item.amount ?? Number(item.qty || 0) * Number(item.rate || 0));
                  return (
                  <div key={getOrderItemKey(item)} className="border-b border-slate-100 py-3 last:border-b-0 sm:py-3.5">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-700 sm:text-lg">{item.name}</div>
                        <div className="mt-1 truncate text-sm text-slate-500 sm:text-base">Qty {item.qty} x Rs. {Number(item.rate || 0).toFixed(2)}</div>
                      </div>
                      <div className="shrink-0 text-base font-black text-slate-900 sm:text-lg">Rs. {itemTotal.toFixed(2)}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOrderQtyAdjust(item, -1)}
                        className="h-9 min-w-9 rounded-xl border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:text-base"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOrderQtyAdjust(item, 1)}
                        className="h-9 min-w-9 rounded-xl border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:text-base"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOrderItemRemove(item)}
                        className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 sm:text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )})}
              </div>
              <div className="mt-4 space-y-2 rounded-2xl bg-[linear-gradient(135deg,#eff6ff_0%,#f0fdf4_100%)] p-3 sm:p-4">
                <div className="flex justify-between text-sm text-slate-600 sm:text-base"><span>Subtotal</span><span className="font-semibold">Rs. {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-slate-600 sm:text-base"><span>Tax</span><span className="font-semibold">Rs. {taxTotal.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-blue-100 pt-2 text-xl font-black text-blue-900 sm:text-2xl"><span>Total</span><span>Rs. {grandTotal.toFixed(2)}</span></div>
              </div>

              {submitError ? <div className="mt-4 text-sm text-rose-600 sm:text-base">{submitError}</div> : null}
            </div>

            {/* Kitchen & Actions */}
            <div className="min-w-0 rounded-[18px] border border-blue-100 bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-5">
              <div className="mb-3 text-xl font-black text-slate-900 sm:mb-4 sm:text-2xl">Kitchen & Actions</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-sm sm:tracking-[0.18em]">Kitchen ETA</div>
                <select
                  value={prepTimeMinutes}
                  onChange={(event) => setPrepTimeMinutes(Number(event.target.value))}
                  className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 sm:text-lg"
                >
                  {[10, 15, 20, 30, 45, 60].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </select>
                <div className="mt-2.5 text-sm text-slate-500">
                  This time will be displayed on the kitchen card and will be used to drive the Ready countdown timer.
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="h-[52px] rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:text-lg"
                >
                  {banquetMenuPicker ? "Use In Banquet" : isSubmitting ? "Submitting..." : "Submit"}
                </button>
                <button
                  onClick={() =>
                    banquetMenuPicker
                      ? navigate(banquetReturnPath, { state: { banquetMenuCancelled: true } })
                      : navigate("/restaurant")
                  }
                  className="h-[52px] rounded-2xl bg-rose-500 text-base font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:text-lg"
                >
                  {banquetMenuPicker ? "Back To Banquet" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuPage;
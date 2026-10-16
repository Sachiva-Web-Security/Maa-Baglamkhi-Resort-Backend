import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import API from "../../api";
import { restaurantService } from "../../services/restaurantService";
import AddMenuItemModal from "./AddMenuItemModal";

const normalizeCategory = (value) => (value || "Other").trim().toLowerCase();

const AddMenuItemPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const table = searchParams.get("table") || "";
  const [menuCatalog, setMenuCatalog] = useState([]);
  const [form, setForm] = useState({ name: "", price: "", category: "Other", tax: 5 });
  const [expandedCategory, setExpandedCategory] = useState("Other");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      try {
        const response = await API.get("/restaurant/menu");
        if (mounted) setMenuCatalog(Array.isArray(response.data) ? response.data : []);
      } catch {
        if (mounted) setMenuCatalog([]);
      }
    };
    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const categories = useMemo(() => {
    const defaults = ["Beverages", "Breakfast", "Paneer", "Salad", "Rice", "Starter", "Chicken", "Chinese", "Soup", "Dessert", "Other"];
    const extra = menuCatalog
      .map((item) => (item.category || "Other").trim() || "Other")
      .filter((value, index, arr) => arr.findIndex((v) => normalizeCategory(v) === normalizeCategory(value)) === index);
    return [...defaults, ...extra].filter(
      (value, index, arr) => arr.findIndex((v) => normalizeCategory(v) === normalizeCategory(value)) === index,
    );
  }, [menuCatalog]);

  const catalogByCategory = useMemo(
    () =>
      categories.reduce((acc, category) => {
        acc[category] = menuCatalog.filter(
          (item) => normalizeCategory(item.category) === normalizeCategory(category),
        );
        return acc;
      }, {}),
    [categories, menuCatalog],
  );

  const handleSubmit = async () => {
    if (!form.name || !form.price) {
      alert("Enter item name and price");
      return;
    }

    try {
      setLoading(true);
      const payload = new FormData();
      payload.append("name", form.name);
      payload.append("price", form.price);
      payload.append("category", form.category);
      payload.append("tableNumber", table || "");
      payload.append("tax", String(form.tax ?? 5));
      if (imageFile) payload.append("image", imageFile);

      await restaurantService.addMenuItem(payload);
      navigate("/restaurant", { replace: true });
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to add menu item");
    } finally {
      setLoading(false);
    }
  };

    return (
      <div className="w-full">
      <div className="mb-4 rounded-[22px] bg-[linear-gradient(135deg,#111827_0%,#1d4ed8_50%,#0f766e_100%)] px-5 py-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-cyan-200">Restaurant Menu Card</div>
            <div className="mt-2 text-4xl font-black">Add Menu Item</div>
            <div className="mt-1 text-xl text-white/80">
              {table ? `Connected table: ${table}` : "No table selected"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/restaurant", { replace: true })}
            className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-xl font-semibold text-white backdrop-blur-md"
          >
            Back To Restaurant
          </button>
        </div>
      </div>

      <AddMenuItemModal
        open
        variant="inline"
        hideCloseAction
        onClose={() => navigate("/restaurant", { replace: true })}
        onSubmit={handleSubmit}
        form={form}
        setForm={setForm}
        categories={categories}
        catalogByCategory={catalogByCategory}
        expandedCategory={expandedCategory}
        setExpandedCategory={setExpandedCategory}
        imagePreview={imagePreview}
        imageFileName={imageFile?.name || ""}
        onImageChange={(event) => setImageFile(event.target.files?.[0] || null)}
        loading={loading}
      />
    </div>
  );
};

export default AddMenuItemPage;

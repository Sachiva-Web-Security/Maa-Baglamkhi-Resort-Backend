import React, { useState } from "react";
import { FaRupeeSign, FaPlus, FaBell, FaBarcode } from "react-icons/fa";
import CategoryInventory from "./CategoryInventory";
import CategoryCard from "./CategoryCard";

const defaultCategories = [];

const initialItems = [
  {
    name: "Tomatoes",
    category: "Raw Ingredients",
    stock: 25,
    unit: "kg",
    price: 40,
    expiry: "2026-02-25",
    branch: "Main",
  },
  {
    name: "Milk",
    category: "Raw Ingredients",
    stock: 5,
    unit: "L",
    price: 55,
    expiry: "2026-02-19",
    branch: "Main",
  },
  {
    name: "Rice",
    category: "Raw Ingredients",
    stock: 0,
    unit: "kg",
    price: 70,
    expiry: "2026-06-01",
    branch: "Branch 2",
  },
];

export default function InventoryDashboard() {
  const [items, setItems] = useState(initialItems);
  const [activeCategory, setActiveCategory] = useState("Raw Ingredients");
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [branch, setBranch] = useState("All");
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState(defaultCategories);
  const [newCategoryName, setNewCategoryName] = useState("");

  const lowStockItems = items.filter((i) => i.stock > 0 && i.stock < 10);
  const outOfStock = items.filter((i) => i.stock === 0);

  const totalValue = items.reduce((sum, i) => {
    const price = Number(i.price) || 0;
    return sum + (price > 0 ? i.stock * price : 0);
  }, 0);

  const filtered = items.filter(
    (i) =>
      i.category === activeCategory && (branch === "All" || i.branch === branch)
  );

  const addItem = (e) => {
    e.preventDefault();
    const form = e.target;
    const newItem = {
      name: form.name.value,
      category: form.category.value,
      stock: Number(form.stock.value),
      unit: form.unit.value,
      price: Number(form.price.value),
      expiry: form.expiry.value,
      branch: form.branch.value,
    };
    setItems([...items, newItem]);
    setShowModal(false);
    form.reset();
  };

  const handleAddItemFromCategory = (newItem) => {
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (index, updatedItem) => {
    const newItems = [...items];
    newItems[index] = updatedItem;
    setItems(newItems);
  };

  const handleDeleteItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setActiveView(category);
  };

  const handleBackToDashboard = () => {
    setActiveView("dashboard");
    setSelectedCategory(null);
  };

  const handleAddNewCategory = (e) => {
    e.preventDefault();
    if (newCategoryName.trim() && !categories.includes(newCategoryName)) {
      setCategories([...categories, newCategoryName]);
      setNewCategoryName("");
      setShowCategoryModal(false);
    }
  };

  const handleDeleteCategory = (categoryToDelete) => {
    setCategories(categories.filter((c) => c !== categoryToDelete));
    setItems(items.filter((i) => i.category !== categoryToDelete));
  };

  const today = new Date();
  const expiryAlerts = items.filter((i) => new Date(i.expiry) <= today);
  

  // For custom categories, use generic CategoryInventory component
  if (activeView && !["dashboard"].includes(activeView)) {
    return <CategoryInventory categoryName={activeView} items={items} onBack={handleBackToDashboard} onAddItem={handleAddItemFromCategory} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} />;
  }

  // Dashboard view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage restaurant inventory with alerts & cost tracking</p>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
          >
            <FaPlus /> Add Category
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <FaPlus /> Add Item
          </button>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-100 p-4 rounded-xl flex items-center gap-3">
          <FaBell /> Low Stock: {lowStockItems.length}
        </div>
        <div className="bg-red-100 p-4 rounded-xl flex items-center gap-3">
          <FaBell /> Out of Stock: {outOfStock.length}
        </div>
        <div className="bg-green-100 p-4 rounded-xl flex items-center gap-3">
          <FaRupeeSign /> Total Value: ₹{totalValue}
        </div>
      </div>

      {/* Expiry Alerts */}
      {expiryAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
          <h3 className="font-semibold text-red-600">Expiry Alerts</h3>
          {expiryAlerts.map((item, i) => (
            <p key={i} className="text-sm text-red-500">
              {item.name} expired on {item.expiry}
            </p>
          ))}
        </div>
      )}

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const categoryItems = items.filter((i) => i.category === category);
          const categoryValue = categoryItems.reduce((sum, i) => sum + i.stock * i.price, 0);
          const isDefault = defaultCategories.includes(category);
          return (
            <CategoryCard
              key={category}
              category={category}
              itemCount={categoryItems.length}
              totalValue={categoryValue}
              onClick={() => handleCategoryClick(category)}
              onDeleteCategory={handleDeleteCategory}
              isDefault={isDefault}
            />
          );
        })}
      </div>

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleAddNewCategory}
            className="bg-white p-6 rounded-xl w-96 space-y-3"
          >
            <h2 className="text-lg font-semibold">Add New Category</h2>
            <input
              type="text"
              placeholder="Category Name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName("");
                }}
                className="px-3 py-1 border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Item Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={addItem}
            className="bg-white p-6 rounded-xl w-96 space-y-3"
          >
            <h2 className="text-lg font-semibold">Add Item</h2>
            <input name="name" placeholder="Item Name" className="border p-2 w-full" required />
            <select name="category" className="border p-2 w-full">
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input name="stock" type="number" placeholder="Stock" className="border p-2 w-full" required />
            <input name="unit" placeholder="Unit" className="border p-2 w-full" required />
            <input name="price" type="number" placeholder="Price" className="border p-2 w-full" required />
            <input name="expiry" type="date" className="border p-2 w-full" required />
            <select name="branch" className="border p-2 w-full">
              <option>Main</option>
              <option>Branch 2</option>
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button className="bg-blue-600 text-white px-3 py-1 rounded">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

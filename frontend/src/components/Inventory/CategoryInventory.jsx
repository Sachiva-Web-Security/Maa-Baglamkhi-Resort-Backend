import React, { useState } from "react";
import { FaRupeeSign, FaPlus, FaBell, FaBarcode, FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";

export default function CategoryInventory({ categoryName, items, onBack, onAddItem, onUpdateItem, onDeleteItem }) {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [branch, setBranch] = useState("All");

  const filtered = items.filter(
    (i) =>
      i.category === categoryName && (branch === "All" || i.branch === branch)
  );

  const lowStockItems = filtered.filter((i) => i.stock > 0 && i.stock < 10);
  const outOfStock = filtered.filter((i) => i.stock === 0);
  const totalValue = filtered.reduce((sum, i) => {
    const price = Number(i.price) || 0;
    return sum + (price > 0 ? i.stock * price : 0);
  }, 0);

  const addItem = (e) => {
    e.preventDefault();
    const form = e.target;
    const newItem = {
      name: form.name.value,
      category: categoryName,
      stock: Number(form.stock.value),
      unit: form.unit.value,
      price: Number(form.price.value),
      expiry: form.expiry.value,
      branch: form.branch.value,
    };
    onAddItem(newItem);
    setShowModal(false);
    form.reset();
  };

  const handleEditClick = (item, index) => {
    setEditingItem({ ...item, index });
    setShowEditModal(true);
  };

  const handleUpdateItem = (e) => {
    e.preventDefault();
    if (editingItem && onUpdateItem) {
      onUpdateItem(editingItem.index, editingItem);
      setShowEditModal(false);
      setEditingItem(null);
    }
  };

  const handleEditChange = (field, value) => {
    setEditingItem({
      ...editingItem,
      [field]: field === "stock" || field === "price" ? Number(value) : value,
    });
  };

  const handleDeleteItem = (index) => {
    if (onDeleteItem && window.confirm("Are you sure you want to delete this item?")) {
      onDeleteItem(index);
    }
  };

  const today = new Date();
  const expiryAlerts = filtered.filter((i) => new Date(i.expiry) <= today);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800">
            <FaArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{categoryName}</h1>
            <p className="text-gray-500 text-sm">Manage {categoryName.toLowerCase()} inventory</p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option>All</option>
            <option>Main</option>
            <option>Branch 2</option>
          </select>

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

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">Stock</th>
              <th className="p-3 text-left">Unit</th>
              <th className="p-3 text-left">Price</th>
              <th className="p-3 text-left">Expiry</th>
              <th className="p-3 text-left">Branch</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-3 text-center text-gray-500">
                  No items in this category
                </td>
              </tr>
            ) : (
              filtered.map((item, i) => {
                const actualIndex = items.findIndex(
                  (it) =>
                    it.name === item.name &&
                    it.category === item.category &&
                    it.branch === item.branch
                );
                return (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3">
                      {item.stock}
                      {item.stock < 10 && item.stock > 0 && (
                        <span className="ml-2 text-yellow-600 text-xs">Low</span>
                      )}
                      {item.stock === 0 && (
                        <span className="ml-2 text-red-600 text-xs">Out</span>
                      )}
                    </td>
                    <td className="p-3">{item.unit}</td>
                    <td className="p-3">₹{item.price}</td>
                    <td className="p-3">{item.expiry}</td>
                    <td className="p-3">{item.branch}</td>
                    <td className="p-3 flex gap-2 justify-center">
                      <button
                        onClick={() => handleEditClick(item, actualIndex)}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(actualIndex)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={addItem}
            className="bg-white p-6 rounded-xl w-96 space-y-3"
          >
            <h2 className="text-lg font-semibold">Add {categoryName} Item</h2>
            <input name="name" placeholder="Item Name" className="border p-2 w-full rounded" required />
            <input name="stock" type="number" placeholder="Stock" className="border p-2 w-full rounded" required />
            <input name="unit" placeholder="Unit (kg, L, etc)" className="border p-2 w-full rounded" required />
            <input name="price" type="number" placeholder="Price" className="border p-2 w-full rounded" required />
            <input name="expiry" type="date" className="border p-2 w-full rounded" required />
            <select name="branch" className="border p-2 w-full rounded">
              <option>Main</option>
              <option>Branch 2</option>
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1 border rounded hover:bg-gray-100">Cancel</button>
              <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={handleUpdateItem}
            className="bg-white p-6 rounded-xl w-96 space-y-3"
          >
            <h2 className="text-lg font-semibold">Edit Item</h2>
            <input
              type="text"
              placeholder="Item Name"
              value={editingItem.name}
              onChange={(e) => handleEditChange("name", e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
            <input
              type="number"
              placeholder="Stock"
              value={editingItem.stock}
              onChange={(e) => handleEditChange("stock", e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
            <input
              type="text"
              placeholder="Unit (kg, L, etc)"
              value={editingItem.unit}
              onChange={(e) => handleEditChange("unit", e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
            <input
              type="number"
              placeholder="Price"
              value={editingItem.price}
              onChange={(e) => handleEditChange("price", e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
            <input
              type="date"
              value={editingItem.expiry}
              onChange={(e) => handleEditChange("expiry", e.target.value)}
              className="border p-2 w-full rounded"
              required
            />
            <select
              value={editingItem.branch}
              onChange={(e) => handleEditChange("branch", e.target.value)}
              className="border p-2 w-full rounded"
            >
              <option>Main</option>
              <option>Branch 2</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                className="px-3 py-1 border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Update</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

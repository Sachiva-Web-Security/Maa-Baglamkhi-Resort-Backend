import React from "react";
import { FaBox, FaArrowRight, FaTrash } from "react-icons/fa";

export default function CategoryCard({ category, itemCount, totalValue, onClick, onDeleteCategory, isDefault }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete category "${category}" and all its items?`)) {
      onDeleteCategory(category);
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-300 relative group"
    >
      {/* Delete Button - Only show for custom categories */}
      {!isDefault && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
          title="Delete category"
        >
          <FaTrash size={16} />
        </button>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-3 rounded-lg">
            <FaBox size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{category}</h3>
            <p className="text-sm text-gray-500">{itemCount} items</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-lg font-bold text-blue-600">₹{totalValue}</p>
          <FaArrowRight className="text-blue-400" />
        </div>
      </div>
    </div>
  );
}

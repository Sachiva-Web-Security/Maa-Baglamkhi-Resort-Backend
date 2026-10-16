import React from "react";
import { FaBox, FaArrowRight, FaTrash } from "react-icons/fa";

export default function CategoryCard({
  category,
  itemCount,
  totalValue,
  onClick,
  onDeleteCategory,
  isDefault
}) {

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 p-4 rounded cursor-pointer hover:bg-gray-700 relative"
    >

      {!isDefault && (
        <button
          onClick={(e)=>{
            e.stopPropagation();
            onDeleteCategory(category)
          }}
          className="absolute top-2 right-2 text-red-400"
        >
          <FaTrash/>
        </button>
      )}

      <div className="flex justify-between items-center">

        <div className="flex gap-3 items-center">

          <FaBox/>

          <div>
            <h3>{category}</h3>
            <p>{itemCount} items</p>
          </div>

        </div>

        <div className="text-right">
          <p>₹{totalValue}</p>
          <FaArrowRight/>
        </div>

      </div>

    </div>
  );
}
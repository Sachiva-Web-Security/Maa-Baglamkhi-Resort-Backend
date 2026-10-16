import React from "react";
import MenuRecipeManager from "../components/Inventory/MenuRecipeManager";

export default function MenuRecipeModulePage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <MenuRecipeManager />
      </div>
    </div>
  );
}

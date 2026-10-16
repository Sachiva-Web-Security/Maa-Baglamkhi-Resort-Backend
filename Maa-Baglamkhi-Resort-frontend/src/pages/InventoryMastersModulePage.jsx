import React from "react";
import InventoryMastersManager from "../components/Inventory/InventoryMastersManager";
import BackButton from "../components/Inventory/BackButton";

export default function InventoryMastersModulePage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <BackButton />
        <InventoryMastersManager />
      </div>
    </div>
  );
}

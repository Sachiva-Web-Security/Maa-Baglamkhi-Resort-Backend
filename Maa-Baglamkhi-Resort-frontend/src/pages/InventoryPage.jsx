// src/pages/InventoryPage.jsx
//
// Simple wrapper that mounts <InventoryFlow /> as a page. Drop into your
// router like any other page:
//
//   <Route path="/inventory" element={<InventoryPage />} />
//
import React from "react";
import InventoryFlow from "../components/Inventory/InventoryFlow";

const InventoryPage = () => {
  return <InventoryFlow />;
};

export default InventoryPage;
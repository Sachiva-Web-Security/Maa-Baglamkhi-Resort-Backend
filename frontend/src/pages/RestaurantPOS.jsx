import React, { useState, useEffect } from "react";
import API from "../api";
import TableCard from "../components/Restaurant/TableCard";
import MenuItem from "../components/Restaurant/MenuItem";
import OrderSummary from "../components/Restaurant/OrderSummary";
import PaymentSection from "../components/Restaurant/PaymentSection";
import Modal from "../components/Hotel/Modal";
import "./RestaurantPOS.css";

const RestaurantPOS = () => {

  const [selectedTable, setSelectedTable] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [tables, setTables] = useState([]);

  const [newTable, setNewTable] = useState({
    number: "",
    status: "Available",
    guestCount: ""
  });
  const [billData, setBillData] = useState({
  subtotal: 0,
  gst: 0,
  total: 0,
  billId: null
});

  /* =========================
     FETCH TABLES ON LOAD
  ========================== */
  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await API.get("/restaurant/tables");
      setTables(res.data);
    } catch (err) {
      console.error("Fetch tables error:", err);
    }
  };

const handleGenerateBill = async (paymentMethod) => {
  if (!selectedTable) return alert("Select a table first");
  try {
    await API.post("/restaurant/bill", {
      tableNumber: parseInt(selectedTable.number.replace("T", "")),
      paymentMethod
    });
    alert("Bill generated successfully");
    setOrderItems([]);
    setBillData({ subtotal: 0, gst: 0, total: 0, billId: null });
  } catch (err) {
    console.error("Generate bill error:", err);
  }
};






  /* =========================
     ADD TABLE
  ========================== */
  const handleAddTable = async () => {

    if (!newTable.number || !newTable.guestCount) {
      alert("Please fill all fields");
      return;
    }

    try {
      const res = await API.post("/restaurant/add-table", {
        number: newTable.number,
        status: newTable.status,
        guestCount: Number(newTable.guestCount)
      });

      const savedTable = {
        id: res.data.tableId,
        number: newTable.number,
        status: newTable.status,
        guestCount: Number(newTable.guestCount)
      };

      setTables(prev => [...prev, savedTable]);

      setNewTable({
        number: "",
        status: "Available",
        guestCount: ""
      });

      setShowAddTableModal(false);

    } catch (err) {
      console.error("Add Table Error:", err);
      alert("Failed to add table");
    }
  };

  /* =========================
     TABLE CLICK
  ========================== */
  const handleTableClick = async (table) => {
  setSelectedTable(table);

  try {
    const res = await API.get(`/restaurant/orders/${table.number}`);
    const items = res.data.items;
    setOrderItems(items);

    const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const gst = subtotal * 0.05;
    const total = subtotal + gst;

    setBillData({
      subtotal,
      gst,
      total,
      billId: res.data.billId || null
    });
  } catch (err) {
    console.error("Fetch pending order error:", err);
    setOrderItems([]);
    setBillData({ subtotal: 0, gst: 0, total: 0, billId: null });
  }
};
  

  /* =========================
     ORDER FUNCTIONS
  ========================== */
  const handleAddToOrder = (item) => {

    if (!selectedTable) {
      alert("Please select a table first");
      return;
    }

    const existingItem = orderItems.find(i => i.id === item.id);

    if (existingItem) {
      setOrderItems(prev =>
        prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setOrderItems(prev => [...prev, { ...item, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (itemId) => {
    setOrderItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleUpdateQuantity = (itemId, quantity) => {
    if (quantity <= 0) return;
    setOrderItems(prev =>
      prev.map(i =>
        i.id === itemId ? { ...i, quantity } : i
      )
    );
  };

  const calculateTotal = () => {
    const subtotal = orderItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
    const gst = subtotal * 0.05;
    return subtotal + gst;
  };

  /* =========================
     SEND TO KITCHEN
  ========================== */
  const sendToKitchen = async () => {
  if (!selectedTable) return alert("Select table first");
  if (orderItems.length === 0) return alert("Add items first");

  try {
    await API.post("/kitchen/order", {
      table: selectedTable.number,
      waiter: "Current Waiter",
      items: orderItems
    });

    alert("Order sent to kitchen");
    // ⚠️ Do NOT clear orderItems or billData here
    // setOrderItems([]);
    // setBillData({ subtotal: 0, gst: 0, total: 0, billId: null });
  } catch (err) {
    console.error("Kitchen Error:", err);
  }
};

  /* =========================
     MENU STATIC DATA
  ========================== */
  const menuItems = [
    { id: 1, name: "Paneer Butter Masala", price: 250 },
    { id: 2, name: "Veg Biryani", price: 180 },
    { id: 3, name: "Cold Drink", price: 60 }
  ];

  return (
    <div className="restaurant-pos-container">

      {/* TABLE SECTION */}
      <div className="tables-section">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>Tables</h2>
          <button onClick={() => setShowAddTableModal(true)}>
            + Add Table
          </button>
        </div>

        <div className="tables-grid">
          {tables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onClick={handleTableClick}
              isSelected={selectedTable?.id === table.id}
            />
          ))}
        </div>
      </div>

      {/* MENU SECTION */}
      <div className="menu-section">
        <h2>Menu</h2>

        {selectedTable && (
          <div>Selected Table {selectedTable.number}</div>
        )}

        {menuItems.map(item => (
          <MenuItem
            key={item.id}
            item={item}
            onAddToOrder={handleAddToOrder}
          />
        ))}
      </div>

      {/* BILLING */}
      <div className="billing-section">

        <button onClick={sendToKitchen}>
          Send Order To Kitchen
        </button>

        <OrderSummary
          orderItems={orderItems}
          onRemoveItem={handleRemoveItem}
          onUpdateQuantity={handleUpdateQuantity}
        />

        <PaymentSection
  totalAmount={calculateTotal()}
  selectedTable={selectedTable}
  onGenerateBill={handleGenerateBill} // ✅ pass prop
/>
      </div>

      {/* ADD TABLE MODAL */}
      <Modal
        isOpen={showAddTableModal}
        onClose={() => setShowAddTableModal(false)}
        title="Add New Table"
      >
        <div>

          <input
            type="text"
            placeholder="Table Number (e.g. T20)"
            value={newTable.number}
            onChange={(e) =>
              setNewTable({ ...newTable, number: e.target.value })
            }
          />

          <select
            value={newTable.status}
            onChange={(e) =>
              setNewTable({ ...newTable, status: e.target.value })
            }
          >
            <option>Available</option>
            <option>Occupied</option>
            <option>Reserved</option>
          </select>

          <input
            type="number"
            placeholder="Guest Count"
            value={newTable.guestCount}
            onChange={(e) =>
              setNewTable({ ...newTable, guestCount: e.target.value })
            }
          />

          <button onClick={handleAddTable}>
            Add Table
          </button>

        </div>
      </Modal>

    </div>
  );
};

export default RestaurantPOS;
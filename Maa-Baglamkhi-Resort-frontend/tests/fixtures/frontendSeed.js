export const frontendSeed = {
  auth: {
    token: "seed-token-123",
    email: "accounts@test.com",
  },
  restaurant: {
    table: { id: 7, number: "T-07", status: "available" },
    menuItem: { id: 11, name: "Veg Thali", price: 250, category: "Main Course" },
    orderItems: [
      { name: "Veg Thali", price: 250, quantity: 2 },
      { name: "Coffee", price: 80, quantity: 1 },
    ],
    bill: {
      id: 4,
      customerName: "Walk-in Guest",
      tableNumber: "T-07",
      total: 580,
      paymentMethod: "UPI",
      invoiceStatus: "paid",
    },
  },
  housekeeping: {
    room: {
      id: 14,
      roomNo: "201",
      roomNumber: "201",
      status: "Dirty",
      assignee: "Neha",
    },
  },
  hotel: {
    bookingId: 22,
    bookingCode: "BK-TEST-0022",
    bookingDraft: {
      guest: { name: "Riya Sharma", phone: "9999999999" },
      stay: { roomNo: "201", nights: 2 },
    },
  },
  inventory: {
    sectionKey: "suppliers",
    record: { id: 3, name: "Fresh Farms", status: "active" },
  },
  menuRecipes: {
    menuItemId: 31,
    recipeRowId: 88,
    ingredient: { inventoryId: 4, quantity: 2, unit: "kg" },
  },
};

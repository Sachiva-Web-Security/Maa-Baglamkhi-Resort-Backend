import API from "../api";

export const restaurantService = {
  async getTables() {
    const response = await API.get("/restaurant/tables");
    return response.data;
  },

  async addTable(payload) {
    const response = await API.post("/restaurant/tables", payload);
    return response.data;
  },

  async updateTable(id, payload) {
    const response = await API.put(`/restaurant/tables/${id}`, payload);
    return response.data;
  },

  async deleteTable(id) {
    const response = await API.delete(`/restaurant/tables/${id}`);
    return response.data;
  },

  async getMenu(tableNumber) {
    const response = await API.get("/restaurant/menu", {
      params: { tableNumber: String(tableNumber) },
    });
    return response.data;
  },

  async addMenuItem(payload) {
    const response = await API.post("/restaurant/menu", payload);
    return response.data;
  },

  async updateMenuItem(id, payload) {
    const response = await API.put(`/restaurant/menu/${id}`, payload);
    return response.data;
  },

  async deleteMenuItem(id) {
    const response = await API.delete(`/restaurant/menu/${id}`);
    return response.data;
  },

  async createOrder(tableNumber, items) {
    let orderId = null;
    for (const item of items) {
      const response = await API.post("/restaurant/order/add", { tableNumber, item });
      orderId = response.data?.orderId || orderId;
    }
    return { orderId };
  },

  async getPendingOrder(tableNumber) {
    const response = await API.get(`/restaurant/order/${tableNumber}`);
    return response.data;
  },

  async getOrderItems(orderId) {
    const response = await API.get(`/restaurant/order-items/${orderId}`);
    return response.data;
  },

  async updateOrder(orderId, payload) {
    const response = await API.put(`/restaurant/order/${orderId}`, payload);
    return response.data;
  },

  async deleteOrder(orderId) {
    const response = await API.delete(`/restaurant/order/${orderId}`);
    return response.data;
  },

  async getOrders() {
    const response = await API.get("/restaurant/order");
    return response.data;
  },

  async getBills() {
    const response = await API.get("/restaurant/bills");
    return response.data;
  },

  async createSplitBill(payload) {
    const response = await API.post("/restaurant/split-bills", payload);
    return response.data;
  },

  async createBill(payload) {
    const response = await API.post("/restaurant/bill", payload);
    return response.data;
  },

  async payBill(payload) {
    const billId = payload?.billId;
    const endpoint = billId ? `/restaurant/bill/${billId}/pay` : "/restaurant/bill/pay";
    const response = await API.post(endpoint, payload);
    return response.data;
  },

  async chargeBillToRoom(payload) {
    const billId = payload?.billId;
    const endpoint = billId
      ? `/restaurant/bill/${billId}/charge-to-room`
      : "/restaurant/bill/charge-to-room";
    const response = await API.post(endpoint, payload);
    return response.data;
  },

 async chargeSplitBillToRoom(payload) {
    const billId = payload?.billId;
    const endpoint = billId
      ? `/restaurant/split-bills/${billId}/charge-to-room`
      : "/restaurant/split-bills/charge-to-room";

    const response = await API.post(endpoint, payload);
    return response.data;
  },

  async createKitchenOrder(payload) {
    const response = await API.post("/kitchen/order", payload);
    return response.data;
  },

  // ── Room Service Delivery ─────────────────────────────────────────────────
  async assignWaiter(payload) {
    const response = await API.post("/room-service-delivery/assign-waiter", payload);
    return response.data;
  },

  async getWaiterDeliveryQueue(waiterName) {
    const response = await API.get("/room-service-delivery/waiter-queue", {
      params: { waiterName },
    });
    return response.data;
  },

  async markDelivered(assignmentId) {
    const response = await API.post(`/room-service-delivery/mark-delivered/${assignmentId}`);
    return response.data;
  },

  async cancelRoomServiceOrder(payload) {
    const response = await API.post("/room-service-delivery/cancel", payload);
    return response.data;
  },

  async getReadyRoomOrders() {
    const response = await API.get("/room-service-delivery/ready-room-orders");
    return response.data;
  },

  async getCancellationLog(kitchenOrderId) {
    const response = await API.get(`/room-service-delivery/cancellation-log/${kitchenOrderId}`);
    return response.data;
  },

  async getKitchenOrders() {
    const response = await API.get("/kitchen/orders");
    return response.data;
  },

  async updateKitchenOrderStatus(id, payload) {
    const response = await API.put(`/kitchen/orders/${id}`, payload);
    return response.data;
  },

  async cancelKitchenOrder(id) {
    const response = await API.put(`/kitchen/orders/${id}/cancel`);
    return response.data;
  },

  async removeKitchenOrder(id) {
    const response = await API.delete(`/kitchen/orders/${id}`);
    return response.data;
  },

  async saveKitchenOrder(id, payload) {
    const response = await API.put(`/kitchen/orders/${id}/save`, payload);
    return response.data;
  },

  async getWaiterPerformance() {
    try {
      const response = await API.get("/restaurant/waiter-performance");
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },

  async getItemActionRequests() {
    try {
      const response = await API.get("/restaurant/item-action-requests");
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },

  async createItemActionRequest(payload) {
    const response = await API.post("/restaurant/item-action-requests", payload);
    return response.data;
  },

  async reviewItemActionRequest(id, payload) {
    const response = await API.put(`/restaurant/item-action-requests/${id}/review`, payload);
    return response.data;
  },

  async sendRestaurantInvoiceWhatsApp(billId, payload = {}) {
    const response = await API.post(`/restaurant/invoice/send-whatsapp/${billId}`, payload, {
      timeout: 30_000,
    });
    return response.data;
  },

  // ── Token Item Operations ──────────────────────────────────────────────────
  async updateTokenItem(itemId, payload) {
    const response = await API.put("/token/item", { id: itemId, ...payload });
    return response.data;
  },

  async deleteTokenItem(itemId) {
    const response = await API.delete(`/token/item/${itemId}`);
    return response.data;
  },
};

export default restaurantService;

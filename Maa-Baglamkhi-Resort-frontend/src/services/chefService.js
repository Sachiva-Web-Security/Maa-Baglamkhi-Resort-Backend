import API from "../api";

export const chefService = {
  async getOrders() {
    const response = await API.get("/chef/orders");
    return response.data;
  },

  async updateOrderStatus(id, payload) {
    const response = await API.put(`/chef/orders/${id}/status`, payload);
    return response.data;
  },

  async getNotifications() {
    const response = await API.get("/chef/notifications");
    return response.data;
  },

  async markNotificationRead(id) {
    const response = await API.post(`/chef/notifications/${id}/read`);
    return response.data;
  },

  async markAllNotificationsRead() {
    const response = await API.post("/chef/notifications/mark-all-read");
    return response.data;
  },

  async createNotification(payload) {
    const response = await API.post("/chef/notifications", payload);
    return response.data;
  },

  async deleteNotification(id) {
    const response = await API.delete(`/chef/notifications/${id}`);
    return response.data;
  },

  // ──────── Chef Issue & Return (raw material) ────────
  async getChefIssues(params = {}) {
    const search = new URLSearchParams();
    if (params.status) search.append("status", params.status);
    if (params.chefId) search.append("chefId", params.chefId);
    if (params.chefName) search.append("chefName", params.chefName);
    const qs = search.toString();
    const response = await API.get(`/inventory/chef-issues${qs ? `?${qs}` : ""}`);
    return response.data;
  },

  async createChefIssue(payload) {
    const response = await API.post("/inventory/chef-issues", payload);
    return response.data;
  },

  async returnChefIssue(id, payload) {
    const response = await API.put(`/inventory/chef-issues/${id}/return`, payload);
    return response.data;
  },

  async getInventoryItems() {
    const response = await API.get("/inventory");
    return response.data;
  },
};

export default chefService;

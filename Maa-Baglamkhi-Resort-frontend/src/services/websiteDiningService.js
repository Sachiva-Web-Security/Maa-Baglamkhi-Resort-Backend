import API from "../api";

export const websiteDiningService = {
  async getDiningConfig() {
    const response = await API.get("/web/dining/config");
    return response.data?.data || response.data;
  },

  async getDiningAvailability(params) {
    const response = await API.get("/web/dining/availability", {
      params: {
        reservationDate: params?.reservationDate,
        guestCount: params?.guestCount,
      },
    });
    return response.data?.data || response.data;
  },

  async createReservation(payload) {
    const response = await API.post("/web/dining/reservations", payload);
    return response.data?.data || response.data;
  },

  async getReservationByCode(code) {
    const response = await API.get(`/web/dining/reservations/${code}`);
    return response.data?.data || response.data;
  },

  async cancelReservation(code, payload = {}) {
    const response = await API.patch(`/web/dining/reservations/${code}/cancel`, payload);
    return response.data?.data || response.data;
  },

  async getAdminReservations(params = {}) {
    const response = await API.get("/web/dining/admin/reservations", { params });
    return response.data?.data || response.data;
  },

  async confirmReservation(id, payload = {}) {
    const response = await API.patch(`/web/dining/admin/reservations/${id}/confirm`, payload);
    return response.data?.data || response.data;
  },

  async assignTable(id, payload = {}) {
    const response = await API.patch(`/web/dining/admin/reservations/${id}/assign-table`, payload);
    return response.data?.data || response.data;
  },

  async markSeated(id, payload = {}) {
    const response = await API.patch(`/web/dining/admin/reservations/${id}/seat`, payload);
    return response.data?.data || response.data;
  },

  async markNoShow(id, payload = {}) {
    const response = await API.patch(`/web/dining/admin/reservations/${id}/no-show`, payload);
    return response.data?.data || response.data;
  },
};

export default websiteDiningService;

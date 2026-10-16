import API from "../api";

export const housekeepingService = {
  async getAllRooms() {
    const response = await API.get("/housekeeping");
    return response.data;
  },

  async getLogs() {
    const response = await API.get("/housekeeping/logs");
    return response.data;
  },

  async createRoom(data) {
    const payload = {
      ...data,
      roomNumber: data?.roomNumber ?? data?.roomNo,
    };
    const response = await API.post("/housekeeping", payload);
    return response.data;
  },

  async updateRoom(id, data) {
    const response = await API.put(`/housekeeping/${id}`, data);
    return response.data;
  },

  async updateRoomStatus(id, status) {
    const response = await API.put(`/housekeeping/status/${id}`, { status });
    return response.data;
  },

  async updateRoomAssignee(id, assignee) {
    const response = await API.put(`/housekeeping/assignee/${id}`, { assignee });
    return response.data;
  },

  async deleteRoom(id) {
    const response = await API.delete(`/housekeeping/${id}`);
    return response.data;
  },

  async getCompletedCleaningLogs(params = {}) {
    const response = await API.get("/housekeeping/completed-cleaning", { params });
    return response.data;
  },

  async createCompletedCleaningLog(data) {
    const response = await API.post("/housekeeping/completed-cleaning", data);
    return response.data;
  },
};

export default housekeepingService;

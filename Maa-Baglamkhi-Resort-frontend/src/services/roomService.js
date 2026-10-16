import API from "../api";

export const roomService = {
  getRooms: async () => {
    const res = await API.get("/room-service/rooms");
    return res.data || [];
  },

  addRoom: async (number) => {
    const res = await API.post("/room-service/rooms", { number: String(number) });
    return res.data;
  },

  addMenuItem: async (payload) => {
    const res = await API.post("/room-service/menu", payload);
    return res.data;
  },

  addOrderItems: async (roomNumber, items) => {
    const res = await API.post("/room-service/order/add", {
      roomNumber,
      items,
    });
    return res.data;
  },

  getMenu: async () => {
    const res = await API.get("/room-service/menu");
    return res.data || [];
  },
};

export default roomService;

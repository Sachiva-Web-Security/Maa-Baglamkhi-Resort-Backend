import API from "../api";

export const userService = {
    getAllUsers: async () => {
        const response = await API.get("/users");
        return response.data;
    }
};

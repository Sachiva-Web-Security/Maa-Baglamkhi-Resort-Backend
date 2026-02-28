import React, { useState, useEffect } from "react";
import { FaUserPlus, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API from "../api";

const User = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const loggedInEmail = localStorage.getItem("email") || "";
  const loggedInAvatar = localStorage.getItem("avatarUrl") || "";

  // Load users from backend + localStorage every time page opens
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/users");
        // Adjust this depending on your backend response shape
        const apiData = Array.isArray(res.data)
          ? res.data
          : res.data.users || [];

        const localUsers =
          JSON.parse(localStorage.getItem("users")) || [];

        // Simple merge (backend + localStorage)
        setUsers([...apiData, ...localUsers]);
      } catch (err) {
        console.error("Failed to load users", err);
        setError("Users load nahi ho pa rahe. Backend check karein.");

        // Backend fail ho to kam se kam localStorage se dikha do
        const localUsers =
          JSON.parse(localStorage.getItem("users")) || [];
        setUsers(localUsers);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    const name =
      (u.name || u.fullName || u.username || "").toString().toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-indigo-100 via-blue-100 to-purple-100">
      
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>

        <button
          onClick={() => navigate("/create-user")}
          className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl"
        >
          <FaUserPlus />
          Add User
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <FaSearch className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search users..."
          className="w-full pl-10 pr-4 py-2 rounded-xl border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user, index) => {
          const displayName =
            user.name || user.fullName || user.username || "Unknown User";
          const email = user.email || user.username || "N/A";
          const role = user.role || user.userRole || "N/A";
          const initial = displayName.toString().charAt(0).toUpperCase();

          // Agar backend future me avatar bheje to use kar sakte hain
          const backendAvatar = user.avatar || user.avatarUrl || "";

          // Current logged-in user ke liye localStorage wala avatar use karo
          const avatarSrc =
            (email && email === loggedInEmail && loggedInAvatar) ||
            backendAvatar ||
            "";

          return (
            <div
              key={user.id || user._id || index}
              className="bg-white p-5 rounded-2xl shadow-lg"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold overflow-hidden">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initial || "?"
                  )}
                </div>

                <div>
                  <h2 className="font-semibold">{displayName}</h2>
                  <p className="text-sm text-gray-500">{email}</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-600">
                {role}
              </span>
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <p className="text-center mt-10 text-gray-500">
          No users created yet
        </p>
      )}
    </div>
  );
};

export default User;
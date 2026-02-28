import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";

const CreateUser = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Staff",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post("/users", form);

      alert(res.data.message);

      // LocalStorage me bhi safe user store karein (password ke bina)
      const existing = JSON.parse(localStorage.getItem("users")) || [];
      const localUser = {
        id: Date.now(),
        name: form.name,
        email: form.email,
        role: form.role,
      };
      localStorage.setItem("users", JSON.stringify([...existing, localUser]));

      navigate("/user");   // dashboard
    } catch (error) {
      console.log(error);
      alert("Error creating user");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg">

        <h2 className="text-2xl font-bold mb-6">Create New User</h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="text"
            name="name"
            placeholder="Full Name"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full p-3 border rounded-xl"
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full p-3 border rounded-xl"
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            value={form.password}
            onChange={handleChange}
            className="w-full p-3 border rounded-xl"
          />

          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full p-3 border rounded-xl"
          >
            <option>Admin</option>
            <option>Manager</option>
            <option>Staff</option>
            <option>Receptionist</option>
            <option>Housekeeping</option>
            <option>Accountant</option>
            <option>waiter</option>
            <option>kitchen</option>
            
          </select>

          <button
            type="submit"
            className="w-full bg-indigo-500 text-white py-3 rounded-xl"
          >
            Create User
          </button>

        </form>
      </div>
    </div>
  );
};

export default CreateUser;
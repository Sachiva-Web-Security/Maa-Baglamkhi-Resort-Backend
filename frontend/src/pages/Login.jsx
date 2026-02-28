import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import bgImage from "../assets/bg.jpg";

const Login = ({ setIsAuthenticated }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "Admin",
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      // ✅ Correct backend endpoint: /api/auth/login
      const res = await API.post("/auth/login", {
        email: formData.username,
        password: formData.password,
      });

      const user = res.data;

      // ✅ Save Data
      localStorage.setItem("token", user.token);
      localStorage.setItem("role", user.role.toLowerCase());
      localStorage.setItem("name", user.name);
      localStorage.setItem("email", user.email);
      localStorage.setItem("isAuthenticated", "true");

      if (setIsAuthenticated) {
        setIsAuthenticated(true);
      }

      alert("✅ Login Successful");

      navigate("/dashboard");

    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Invalid Credentials";

      alert(errorMsg);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center font-[Poppins] bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${bgImage})`,
      }}
    >
      <div className="w-[380px] p-10 rounded-2xl bg-white/20 backdrop-blur-xl shadow-2xl border border-white/30">

        {/* Header */}
        <div className="text-center mb-8 text-white">
          <div className="text-xl font-bold mb-2">LOGO</div>
          <h1 className="text-2xl font-semibold">
            Maa Baglamukhi Resort
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div className="text-left">
            <label className="text-sm text-white font-semibold">
              Email Address
            </label>
            <input
              type="email"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter email (admin@hotel.com)"
              required
              className="w-full bg-white/40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          {/* Password */}
          <div className="text-left">
            <label className="text-sm text-white font-semibold">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
              className="w-full bg-white/40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          {/* Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold hover:opacity-90 transition"
          >
            Login
          </button>

        </form>
      </div>
    </div>
  );
};

export default Login;
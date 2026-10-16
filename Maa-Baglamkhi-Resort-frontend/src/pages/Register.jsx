import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";

// Referenced from /public so a missing file never crashes the app (see Login.jsx).
const bgImage = "/bg.jpg";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "admin",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (
      !formData.name?.trim() ||
      !formData.email?.trim() ||
      !formData.password
    ) {
      setError("Name, email and password are required.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await API.post("/auth/register", {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role || "admin",
      });
      alert("Account created. You can now log in.");
      navigate("/login");
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center font-[Poppins] bg-cover bg-center"
      style={{
        backgroundColor: "#0b1730",
        backgroundImage: `linear-gradient(135deg, #081225 0%, #0b1730 55%, #09101f 100%), url(${bgImage})`,
        backgroundBlendMode: "overlay",
      }}
    >
      <div className="w-[90%] sm:w-[380px] p-6 sm:p-10 rounded-2xl bg-black/20 backdrop-blur-xl shadow-2xl border border-white/30">
        <div className="text-center mb-6 text-white">
          <div className="text-xl font-bold mb-2">LOGO</div>
          <h1 className="text-2xl font-semibold">Maa Baglamukhi Resort</h1>
          <p className="text-sm text-white/80 mt-1">Create account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-300 bg-red-900/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="text-left">
            <label className="text-sm text-white font-semibold">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Full name"
              required
              className="w-full bg-white/40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          <div className="text-left">
            <label className="text-sm text-white font-semibold">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@hotel.com"
              required
              className="w-full bg-white/40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          <div className="text-left">
            <label className="text-sm text-white font-semibold">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 6 characters"
              required
              minLength={6}
              className="w-full bg-white/40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          <div className="text-left">
            <label className="text-sm text-white font-semibold">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              required
              className="w-full bg-white/40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          <div className="text-left">
            <label className="text-sm text-white font-semibold">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full bg-white/40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="receptionist">Receptionist</option>
              <option value="accountant">Accountant</option>
              <option value="waiter">Waiter</option>
              <option value="kitchen">Kitchen</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-white/90 text-sm mt-4">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-purple-300 font-semibold hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
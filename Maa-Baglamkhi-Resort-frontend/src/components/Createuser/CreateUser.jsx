import React, { useState } from "react";
import { FaTimes, FaUserPlus } from "react-icons/fa";

import API from "../../api";

const fieldCls =
  "w-full h-[58px] sm:h-[60px] rounded-2xl border border-blue-200 bg-white px-4 sm:px-5 text-[16px] sm:text-[17px] text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 placeholder:text-[15px] sm:placeholder:text-[16px] focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-blue-300";

const CreateUser = ({ onClose, onUserCreated }) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Staff",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await API.post("/users", form, { skipAuthRedirect: true });

      const createdUser = res.data?.user || {
        id: Date.now(),
        name: form.name,
        email: form.email,
        role: form.role.toLowerCase(),
      };

      if (onUserCreated) {
        onUserCreated(createdUser);
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.log(error);
      const status = error.response?.status;
      if (status === 401) {
        setError("Your session has expired or the authentication token is missing. The create action has been blocked without redirecting you to the login page.");
      } else if (status === 403) {
        setError("Only administrators are authorized to create new user accounts.");
      } else {
        setError(error.response?.data?.message || "Failed to create the user. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 sm:px-4 backdrop-blur-sm">
      <div
        className="animate-[fadeScaleIn_300ms_ease-out] w-full max-w-[92%] sm:max-w-xl md:max-w-2xl lg:max-w-2xl rounded-2xl sm:rounded-[30px] border border-blue-100 bg-white p-5 sm:p-8 md:p-10 shadow-2xl transition-all duration-300 max-h-[92vh] overflow-y-auto"
        style={{
          boxShadow:
            "0 30px 90px rgba(30,58,138,0.22), 0 10px 30px rgba(59,130,246,0.12)",
        }}
      >
        <style>{`
          @keyframes fadeScaleIn {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] sm:text-[16px] font-semibold uppercase tracking-[0.24em] text-blue-500">
              User Onboarding
            </p>
            <h2 className="mt-2 text-[26px] sm:text-[32px] md:text-[36px] leading-tight font-black text-blue-900">
              Create new user
            </h2>
            <p className="mt-2 sm:mt-3 text-[15px] sm:text-[17px] md:text-[18px] text-slate-500">
            Enter the team member's details and assign a role.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-600 shadow-sm transition-all duration-300 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:rotate-90"
          >
            <FaTimes size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            required
            value={form.name}
            onChange={handleChange}
            className={fieldCls}
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            required
            value={form.email}
            onChange={handleChange}
            className={fieldCls}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            value={form.password}
            onChange={handleChange}
            className={fieldCls}
          />

          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className={`${fieldCls} text-[16px] sm:text-[17px]`}
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="Receptionist">Receptionist</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Accountant">Accountant</option>
            <option value="Waiter">Waiter</option>
            <option value="Kitchen">Kitchen</option>
          </select>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 sm:px-5 py-3 sm:py-4 text-[14px] sm:text-[15px] font-semibold text-rose-700 transition-all duration-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full h-[56px] sm:h-[60px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-500 px-5 text-[16px] sm:text-[18px] font-bold text-white shadow-[0_18px_40px_rgba(30,58,138,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(59,130,246,0.45)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            <FaUserPlus size={18} />
            {isSubmitting ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateUser;
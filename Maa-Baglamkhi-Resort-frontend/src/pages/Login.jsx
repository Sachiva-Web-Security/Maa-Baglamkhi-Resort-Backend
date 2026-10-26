// src/pages/Login.jsx
// Staff login with quick role access — design matches the resort mockup.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import { getRoleHome } from "../utils/roleHome";
import { withAudit } from "../utils/auditAction";
import loginBackdrop from "../assets/login_backdrop.png";
import {
  FaArrowRight,
  FaBroom,
  FaConciergeBell,
  FaCrown,
  FaEnvelope,
  FaExclamationTriangle,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaSpa,
  FaSpinner,
  FaUmbrella,
  FaUserTie,
  FaUtensils,
} from "react-icons/fa";

// Quick-access chips: each carries its own icon + accent palette.
const ROLE_LOGIN_HINTS = [
  {
    role: "admin",
    email: "admin@resort.com",
    label: "Admin",
    Icon: FaCrown,
    chip: "border-amber-200/70 bg-amber-50",
    icon: "bg-amber-100 text-amber-600",
  },
  {
    role: "manager",
    email: "manager@resort.com",
    label: "Manager",
    Icon: FaUserTie,
    chip: "border-sky-200/70 bg-sky-50",
    icon: "bg-sky-100 text-sky-600",
  },
  {
    role: "receptionist",
    email: "reception@resort.com",
    label: "Reception",
    Icon: FaConciergeBell,
    chip: "border-emerald-200/70 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-600",
  },
  {
    role: "housekeeping",
    email: "tarun@resort.com",
    label: "Housekeeping",
    Icon: FaBroom,
    chip: "border-violet-200/70 bg-violet-50",
    icon: "bg-violet-100 text-violet-600",
  },
  {
    role: "waiter",
    email: "waiter@resort.com",
    label: "Waiter",
    Icon: FaUmbrella,
    chip: "border-orange-200/70 bg-orange-50",
    icon: "bg-orange-100 text-orange-600",
  },
  {
    role: "chef",
    email: "chef@resort.com",
    label: "Chef",
    Icon: FaUtensils,
    chip: "border-rose-200/70 bg-rose-50",
    icon: "bg-rose-100 text-rose-600",
  },
];

const LOGIN_EMAIL_ALIASES = {
  "admin@resort.com": "admin@test.com",
  "admin@test.com": "admin@resort.com",
  "manager@resort.com": "manager@test.com",
  "manager@test.com": "manager@resort.com",
  "reception@resort.com": "reception@test.com",
  "reception@test.com": "reception@resort.com",
  "accounts@resort.com": "accounts@test.com",
  "accounts@test.com": "accounts@resort.com",
  "tarun@resort.com": "hk@test.com",
  "hk@test.com": "tarun@resort.com",
  "waiter@resort.com": "waiter@test.com",
  "waiter@test.com": "waiter@resort.com",
  "chef@resort.com": "chef@test.com",
  "chef@test.com": "chef@resort.com",
};

const Login = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const loginBody = { email: normalizedEmail, password };

      let res;
      try {
        res = await API.post(
          "/auth/login",
          loginBody,
          withAudit("login"),
        );
      } catch (err) {
        const aliasEmail = LOGIN_EMAIL_ALIASES[normalizedEmail];
        const shouldRetryWithAlias =
          aliasEmail &&
          err.response?.status === 400 &&
          /invalid email/i.test(
            String(err.response?.data?.message || "").toLowerCase(),
          );

        if (!shouldRetryWithAlias) {
          throw err;
        }

        res = await API.post(
          "/auth/login",
          { email: aliasEmail, password },
          withAudit("login"),
        );
      }

      const data = res.data;

      // Save auth state for RoleHomeRedirect and ProtectedRoute
      if (setIsAuthenticated) setIsAuthenticated(true);
      if (data.token) localStorage.setItem("token", data.token);
      if (data.role) localStorage.setItem("role", data.role);
      if (data.name) localStorage.setItem("name", data.name);
      if (data.email) localStorage.setItem("email", data.email);
      navigate(getRoleHome(data.role), { replace: true });
    } catch (err) {
      const base =
        (import.meta.env.VITE_API_URL || "/api").replace(/\/api\/?$/, "") ||
        "backend";
      if (err.message === "Network Error") {
        setError(
          `Cannot reach server. Make sure backend is running at ${base}`,
        );
      } else {
        setError(err.response?.data?.message || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const applyLoginHint = (credential) => {
    setEmail(credential.email);
    setPassword("");
    setError("");
  };

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden px-3 py-6 sm:px-6 sm:py-10"
      style={{
        backgroundColor: "#0b1730",
        backgroundImage: `linear-gradient(95deg, rgba(2,6,23,0.35) 0%, rgba(2,6,23,0.10) 35%, rgba(2,6,23,0.55) 100%), url(${loginBackdrop})`,
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        minHeight: "100vh",
      }}
    >
      <div className="relative z-10 w-full max-w-[34rem] sm:max-w-[36rem]">
        {/* Card */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_40px_110px_-20px_rgba(2,8,30,0.8)] ring-1 ring-white/20">
          {/* Header: backdrop photo + lotus emblem */}
          <div className="relative px-5 pb-5 pt-5 text-center text-white sm:px-6 sm:pb-6 sm:pt-6">
            <img
              src={loginBackdrop}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/35 to-slate-950/70" />

            <div className="relative">
              <FaSpa
                size={34}
                className="mx-auto text-amber-400 drop-shadow-[0_6px_14px_rgba(245,158,11,0.45)]"
              />
              <div className="mt-2.5 text-base font-black leading-tight tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:text-lg">
                Maa BAGLAMUKHI RESORT
              </div>
              <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/80">
                Hotel Management System
              </div>
            </div>
          </div>

          <div className="px-4 py-3.5 sm:px-5 sm:py-4">
            <h2 className="text-center text-base font-black text-slate-900 sm:text-lg">
              Staff Login
            </h2>
            <p className="mt-0.5 text-center text-[11px] font-medium text-indigo-400 sm:text-[12px]">
              Access your account to manage resort operations
            </p>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700"
              >
                <FaExclamationTriangle className="mt-0.5 shrink-0 text-rose-500" size={15} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"
                >
                  <FaEnvelope size={11} className="text-slate-400" />
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  autoComplete="username"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="you@resort.com"
                  required
                  className="w-full rounded-xl bg-indigo-50/80 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none ring-1 ring-indigo-100 transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"
                >
                  <FaLock size={11} className="text-slate-400" />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Your password"
                    required
                    className="w-full rounded-xl bg-indigo-50/80 px-4 py-2.5 pr-11 text-sm font-medium text-slate-900 outline-none ring-1 ring-indigo-100 transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-500"
                  >
                    {showPassword ? (
                      <FaEyeSlash size={15} />
                    ) : (
                      <FaEye size={15} />
                    )}
                  </button>
                </div>
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    title="Password reset coming soon"
                    className="text-[13px] font-semibold text-indigo-500 transition hover:text-indigo-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 py-3 text-[14px] font-bold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin" size={15} />
                    Signing In…
                  </>
                ) : (
                  <>
                    Sign In
                    <FaArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Or Quick Access
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Quick role access */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROLE_LOGIN_HINTS.map(({ Icon, chip, icon, ...rc }) => {
                const active = email.toLowerCase() === rc.email.toLowerCase();
                return (
                  <button
                    key={rc.role}
                    type="button"
                    onClick={() => applyLoginHint(rc)}
                    aria-pressed={active}
                    className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold text-slate-700 transition hover:-translate-y-px md:gap-2 md:px-2.5 ${chip} ${active ? "ring-2 ring-indigo-400" : ""}`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md md:h-6 md:w-6 md:rounded-lg ${icon}`}
                    >
                      <Icon size={11} />
                    </span>
                    <span className="truncate">{rc.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-400">
              These only fill the email — enter your password to sign in.
            </p>

            {/* Footer */}
            <div className="mt-5 flex flex-col items-center gap-2">
              <div className="h-3 w-px bg-slate-300" />
              <p className="px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-[10px] sm:tracking-[0.22em]">
                Secure &bull; Reliable &bull; Hospitality Focused
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

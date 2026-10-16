import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FaCamera,
  FaCheckCircle,
  FaEnvelope,
  FaExclamationCircle,
  FaLock,
  FaPen,
  FaPhone,
  FaShieldAlt,
  FaTimes,
  FaUpload,
  FaUserCircle,
  FaWhatsapp,
} from "react-icons/fa";
import API, { getBackendBaseURL } from "../api";
import { withAudit } from "../utils/auditAction";

const Profile = () => {
  const location = useLocation();
  const securitySectionRef = useRef(null);
  const fileInputRef = useRef(null);

  const [name, setName] = useState(localStorage.getItem("name") || "");
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [email, setEmail] = useState(localStorage.getItem("email") || "");
  const [phone, setPhone] = useState(localStorage.getItem("phone") || "");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(
    localStorage.getItem("avatarUrl") || "",
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [showCamera, setShowCamera] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await API.get("/users/me");
        const d = res.data;
        if (cancelled) return;
        if (d.name) { setName(d.name); localStorage.setItem("name", d.name); }
        if (d.role) { setRole(d.role); localStorage.setItem("role", (d.role || "").toLowerCase()); }
        if (d.email) { setEmail(d.email); localStorage.setItem("email", d.email); }
        if (d.phone) {
          setPhone(d.phone);
          setPhoneDraft(d.phone);
          localStorage.setItem("phone", d.phone);
        }
        if (d.avatarUrl) {
          const full = d.avatarUrl.startsWith("http") ? d.avatarUrl : `${getBackendBaseURL()}${d.avatarUrl}`;
          setAvatarUrl(full);
          localStorage.setItem("avatarUrl", full);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Could not load profile.");
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (location.state?.focusSection !== "security") return;
    securitySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.state]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    handleAvatarUpload(null, file);
  };

  const handleStartCamera = async () => {
    try {
      setCameraError("");
      setShowCamera(true);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera support available nahi hai (browser permission).");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);

      const video = document.getElementById("profile-camera-video");
      if (video) {
        video.srcObject = stream;
        video.play();
      }
    } catch {
      setCameraError("Camera could not be opened. Please allow permission.");
    }
  };

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    setCameraStream(null);
    setShowCamera(false);
    setCameraError("");
  };

  const handleCaptureFromCamera = () => {
    const video = document.getElementById("profile-camera-video");
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 320;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "avatar-camera.jpg", { type: "image/jpeg" });
      setAvatarFile(file);
      const previewUrl = URL.createObjectURL(blob);
      setAvatarUrl(previewUrl);
      handleAvatarUpload(null, file);
    }, "image/jpeg");

    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    const videoEl = document.getElementById("profile-camera-video");
    if (videoEl) {
      videoEl.srcObject = null;
    }
    setCameraStream(null);
    setShowCamera(false);
  };

  const handleAvatarUpload = async (e, fileOverride) => {
    if (e) e.preventDefault();
    const file = fileOverride || avatarFile;
    if (!file) return;

    try {
      setLoadingAvatar(true);
      setMessage("");
      setError("");

      const formData = new FormData();
      formData.append("avatar", file);
      if (email) {
        formData.append("email", email);
      }

      const res = await API.put(
        "/users/me/avatar",
        formData,
        withAudit("update_profile_avatar", {
          headers: { "Content-Type": "multipart/form-data" },
        }),
      );

      let urlFromServer = res.data?.avatarUrl || res.data?.url || avatarUrl;
      if (urlFromServer && !urlFromServer.startsWith("http")) {
        urlFromServer = `${getBackendBaseURL()}${urlFromServer.startsWith("/") ? "" : "/"}${urlFromServer}`;
      }

      if (urlFromServer) {
        setAvatarUrl(urlFromServer);
        localStorage.setItem("avatarUrl", urlFromServer);
      }

      setMessage("Profile picture updated successfully.");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Image upload fail ho gaya. /users/me/avatar endpoint check karein.";
      setError(msg);
    } finally {
      setLoadingAvatar(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Saare password fields bharna zaroori hai.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password aur confirm password match nahi kar rahe.");
      return;
    }

    try {
      setLoadingPassword(true);
      await API.post(
        "/users/change-password",
        { email, currentPassword, newPassword },
        withAudit("change_password"),
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password successfully change ho gaya.");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Password change fail ho gaya.";
      setError(msg);
    } finally {
      setLoadingPassword(false);
    }
  };

  const handlePhoneSave = async () => {
    setMessage("");
    setError("");
    const digits = String(phoneDraft || "").replace(/\D+/g, "");
    if (!digits || digits.length < 10) {
      setError("Please enter a valid 10-digit phone number (with country code if outside India).");
      return;
    }
    try {
      setLoadingPhone(true);
      const res = await API.put(
        "/users/me/phone",
        { phone: digits },
        withAudit("update_profile_phone"),
      );
      const saved = res.data?.phone || digits;
      setPhone(saved);
      setPhoneDraft(saved);
      localStorage.setItem("phone", saved);
      setMessage("WhatsApp number saved. Booking invoices will now be sent to you.");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Phone number save  is fail .";
      setError(msg);
    } finally {
      setLoadingPhone(false);
    }
  };

  const prettyRole =
    role && typeof role === "string"
      ? role.charAt(0).toUpperCase() + role.slice(1)
      : "Role";

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f4f7fb] px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-10 lg:py-10 xl:px-14 2xl:px-20 2xl:py-12">
      <div className="mx-auto w-full max-w-[2200px] space-y-6 lg:space-y-8 2xl:space-y-10">

        {/* ── Gradient header ──────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-r from-blue-900 via-blue-500 to-cyan-400 px-5 py-6 shadow-[0_14px_35px_rgba(14,165,233,0.28)] sm:rounded-[22px] sm:px-8 sm:py-8 md:rounded-[24px] md:px-10 md:py-10 lg:rounded-[24px] lg:px-14 lg:py-12 2xl:px-20 2xl:py-16">
          <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-white/10 sm:h-48 sm:w-48 md:h-56 md:w-56 lg:h-72 lg:w-72 2xl:h-96 2xl:w-96" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/10 sm:h-48 sm:w-48 md:h-56 md:w-56 lg:h-72 lg:w-72 2xl:h-96 2xl:w-96" />
          <div className="relative flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/80 sm:text-xs md:text-sm lg:text-base 2xl:text-lg">
            <FaShieldAlt />
            <span>My Account</span>
          </div>
          <h1 className="relative mt-2.5 text-[22px] font-black text-white sm:text-3xl md:text-4xl lg:mt-4 lg:text-5xl">
            Personal Information
          </h1>
          <p className="relative mt-2 max-w-xl text-[13px] font-medium text-white/90 sm:text-sm md:text-base lg:mt-3 lg:max-w-2xl lg:text-lg 2xl:max-w-3xl 2xl:text-xl">
            Manage your profile picture, contact details, and password from one place.
          </p>
        </div>

        {/* ── Alerts ───────────────────────────────────────────── */}
        {error ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm lg:px-6 lg:py-5 lg:text-base 2xl:text-lg">
            <FaExclamationCircle className="shrink-0 text-sm sm:text-base lg:text-lg" />
            <span>{error}</span>
          </div>
        ) : null}

        {message ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm lg:px-6 lg:py-5 lg:text-base 2xl:text-lg">
            <FaCheckCircle className="shrink-0 text-sm sm:text-base lg:text-lg" />
            <span>{message}</span>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-8 2xl:gap-10">

          {/* ── Avatar card ──────────────────────────────────── */}
          <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] sm:rounded-[24px] sm:p-6 md:rounded-[28px] md:p-8 lg:p-10 2xl:p-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 sm:text-xs md:text-sm lg:text-base 2xl:text-lg">
              Profile Photo
            </p>

            <div className="mt-4 flex flex-col items-center text-center sm:mt-5 md:mt-6 lg:mt-7">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-700 to-sky-400 text-3xl font-black text-white shadow-[0_12px_28px_rgba(14,165,233,0.32)] sm:h-32 sm:w-32 sm:text-4xl md:h-36 md:w-36 md:text-5xl lg:h-44 lg:w-44 lg:text-5xl xl:h-48 xl:w-48 xl:text-6xl 2xl:h-56 2xl:w-56 2xl:text-7xl">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    (name || "U").charAt(0).toUpperCase()
                  )}
                </div>
                <span className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-emerald-500 sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10">
                  <FaCheckCircle className="text-[10px] text-white sm:text-xs md:text-sm lg:text-base" />
                </span>
              </div>

              <h2 className="mt-3 text-base font-black text-slate-900 sm:text-lg md:text-xl lg:mt-5 lg:text-2xl 2xl:text-3xl">
                {name || "User"}
              </h2>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 sm:px-3 sm:py-1 sm:text-xs md:px-4 md:py-1.5 md:text-sm lg:mt-2 lg:px-5 lg:py-2 lg:text-base">
                <FaUserCircle className="text-[10px] sm:text-xs md:text-sm lg:text-sm" />
                {prettyRole}
              </span>

              <div className="mt-5 flex w-full flex-col gap-2.5 sm:mt-6 sm:gap-3 md:mt-7 md:gap-3 lg:mt-8 lg:gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loadingAvatar}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-blue-500 px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(14,165,233,0.28)] transition hover:-translate-y-0.5 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:py-4 lg:text-lg 2xl:py-5 2xl:text-xl"
                >
                  <FaUpload className="text-[10px] sm:text-xs md:text-sm lg:text-base" />
                  {loadingAvatar ? "Uploading..." : "Upload New Picture"}
                </button>
                <button
                  type="button"
                  onClick={handleStartCamera}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-600 sm:px-5 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:py-4 lg:text-lg 2xl:py-5 2xl:text-xl"
                >
                  <FaCamera className="text-[10px] sm:text-xs md:text-sm lg:text-base" />
                  Use Camera
                </button>
              </div>
            </div>

            {showCamera ? (
              <div className="mt-5 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:mt-6 sm:space-y-3 sm:rounded-2xl sm:p-4 md:mt-7 md:space-y-4 md:p-6 lg:mt-8 lg:space-y-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-slate-700 sm:text-sm md:text-base lg:text-lg">Camera Preview</p>
                  <button
                    type="button"
                    onClick={handleCloseCamera}
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 md:p-2 lg:text-lg"
                    aria-label="Close camera"
                  >
                    <FaTimes />
                  </button>
                </div>

                {cameraError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm md:px-5 md:py-4 md:text-base lg:text-lg">
                    {cameraError}
                  </div>
                ) : (
                  <>
                    <video
                      id="profile-camera-video"
                      className="w-full rounded-lg border border-slate-200 bg-slate-950/90 sm:rounded-xl md:rounded-xl lg:rounded-xl"
                      autoPlay
                      muted
                    />
                    <button
                      type="button"
                      onClick={handleCaptureFromCamera}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(14,165,233,0.28)] transition hover:bg-sky-600 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:py-4 lg:text-lg"
                    >
                      <FaCamera />
                      Capture Photo
                    </button>
                  </>
                )}
              </div>
            ) : null}

            <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 sm:mt-6 sm:space-y-3 sm:pt-5 md:mt-7 md:space-y-4 md:pt-6 lg:mt-8 lg:space-y-4 lg:pt-8">
              <div className="flex items-center justify-between gap-2.5 rounded-xl bg-slate-50 px-4 py-3 sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4 md:px-6 md:py-5 lg:px-6 lg:py-5">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 md:gap-4">
                  <FaUserCircle className="shrink-0 text-base text-slate-400 sm:text-lg md:text-lg lg:text-lg" />
                  <span className="truncate text-[13px] font-semibold text-slate-800 sm:text-sm md:text-base lg:text-lg">
                    {name || "Name not set"}
                  </span>
                </div>
                <FaPen className="shrink-0 text-[10px] text-slate-300 sm:text-xs md:text-sm lg:text-sm" />
              </div>

              <div className="flex items-center justify-between gap-2.5 rounded-xl bg-slate-50 px-4 py-3 sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4 md:px-6 md:py-5 lg:px-6 lg:py-5">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 md:gap-4">
                  <FaEnvelope className="shrink-0 text-base text-slate-400 sm:text-lg md:text-lg lg:text-lg" />
                  <span className="truncate text-[13px] font-semibold text-slate-800 sm:text-sm md:text-base lg:text-lg">
                    {email || "Email not set"}
                  </span>
                </div>
                <FaPen className="shrink-0 text-[10px] text-slate-300 sm:text-xs md:text-sm lg:text-sm" />
              </div>

              <div className="flex items-center justify-between gap-2.5 rounded-xl bg-slate-50 px-4 py-3 sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4 md:px-6 md:py-5 lg:px-6 lg:py-5">
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 md:gap-4">
                  <FaPhone className="shrink-0 text-base text-slate-400 sm:text-lg md:text-lg lg:text-lg" />
                  <span className="truncate text-[13px] font-semibold text-slate-800 sm:text-sm md:text-base lg:text-lg">
                    {phone || "Phone not set"}
                  </span>
                </div>
                <FaWhatsapp className="shrink-0 text-[10px] text-emerald-400 sm:text-xs md:text-sm lg:text-sm" />
              </div>

              {loadingProfile ? (
                <p className="text-[13px] font-semibold text-slate-400 sm:text-sm md:text-base lg:text-lg">
                  Profile details load ho rahe hain...
                </p>
              ) : null}
            </div>
          </div>

          {/* ── WhatsApp Phone card ────────────────────────────── */}
          <div className="rounded-[20px] border border-emerald-200 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] sm:rounded-[24px] sm:p-6 md:rounded-[28px] md:p-8 lg:p-10 2xl:p-12">
            <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:h-11 sm:w-11 md:h-12 md:w-12 lg:h-14 lg:w-14 lg:text-xl 2xl:h-16 2xl:w-16 2xl:text-2xl">
                <FaWhatsapp />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600 sm:text-xs md:text-sm lg:text-base">
                  WhatsApp Number
                </p>
                <h2 className="text-base font-black text-slate-900 sm:text-lg md:text-xl lg:text-2xl 2xl:text-3xl">
                  Invoice Delivery
                </h2>
              </div>
            </div>

            <p className="mt-3 text-[13px] font-medium leading-relaxed text-slate-500 sm:text-sm md:text-base lg:mt-4 lg:text-lg 2xl:text-xl">
              Enter your WhatsApp number here. Invoice PDFs will be automatically sent to this number whenever a booking is created or a payment is updated.
            </p>

            <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:flex-row sm:items-center sm:gap-3 lg:mt-7">
              <input
                type="tel"
                inputMode="numeric"
                placeholder="9876543210"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value.replace(/\D+/g, "").slice(0, 15))}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 sm:px-5 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:px-6 lg:py-4 lg:text-lg"
              />
              <button
                type="button"
                onClick={handlePhoneSave}
                disabled={loadingPhone || phoneDraft === phone}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.28)] transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:py-4 lg:text-lg"
              >
                <FaCheckCircle className="text-[10px] sm:text-xs md:text-sm lg:text-base" />
                {loadingPhone ? "Saving..." : phoneDraft === phone ? "Saved" : "Save Number"}
              </button>
            </div>

            {phone ? (
              <p className="mt-2.5 text-[11px] font-medium text-slate-400 sm:text-xs md:text-sm lg:text-base">
                Current number: +{phone}
              </p>
            ) : (
              <p className="mt-2.5 text-[11px] font-medium text-amber-600 sm:text-xs md:text-sm lg:text-base">
               No WhatsApp number is configured yet.
              </p>
            )}
          </div>

          {/* ── Password card ────────────────────────────────── */}
          <div
            ref={securitySectionRef}
            className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] sm:rounded-[24px] sm:p-6 md:rounded-[28px] md:p-8 lg:p-10 2xl:p-12"
          >
            <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-11 sm:w-11 md:h-12 md:w-12 md:text-lg lg:h-14 lg:w-14 lg:text-xl 2xl:h-16 2xl:w-16 2xl:text-2xl">
                <FaLock />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 sm:text-xs md:text-sm lg:text-base">
                  Security
                </p>
                <h2 className="text-base font-black text-slate-900 sm:text-lg md:text-xl lg:text-2xl 2xl:text-3xl">
                  Change Password
                </h2>
              </div>
            </div>

            <p className="mt-3 text-[13px] font-medium leading-relaxed text-slate-500 sm:text-sm md:text-base lg:mt-4 lg:text-lg 2xl:text-xl">
              Update your password securely from here.
            </p>

            <form onSubmit={handlePasswordChange} className="mt-5 space-y-4 sm:mt-6 sm:space-y-5 md:mt-7 md:space-y-5 lg:mt-8 lg:space-y-7">
              <div>
                <label
                  htmlFor="current-password"
                  className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs md:text-sm lg:mb-2.5 lg:text-base"
                >
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-sky-100 sm:px-5 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:px-6 lg:py-4.5 lg:text-lg 2xl:py-5 2xl:text-xl"
                  placeholder="Enter current password"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 md:gap-5 lg:gap-6">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs md:text-sm lg:mb-2.5 lg:text-base">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-sky-100 sm:px-5 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:px-6 lg:py-4.5 lg:text-lg 2xl:py-5 2xl:text-xl"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs md:text-sm lg:mb-2.5 lg:text-base">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-sky-100 sm:px-5 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:px-6 lg:py-4.5 lg:text-lg 2xl:py-5 2xl:text-xl"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1 lg:pt-2">
                <button
                  type="submit"
                  disabled={loadingPassword}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-500 px-6 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(14,165,233,0.28)] transition hover:-translate-y-0.5 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8 sm:py-3 sm:text-sm md:py-3.5 md:text-base lg:px-12 lg:py-4 lg:text-lg 2xl:px-14 2xl:py-5 2xl:text-xl"
                >
                  {loadingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>

            {/* Account overview strip */}
            <div className="mt-5 grid gap-2.5 border-t border-slate-100 pt-4 sm:mt-6 sm:grid-cols-2 sm:gap-3 md:mt-7 md:gap-4 md:pt-6 lg:mt-10 lg:gap-4 lg:pt-8">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 md:p-5 lg:p-6">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs md:text-sm lg:text-sm">
                  Role
                </div>
                <div className="mt-1 text-sm font-black text-slate-900 sm:text-base md:text-lg lg:mt-2 lg:text-xl 2xl:text-2xl">
                  {prettyRole}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 md:p-5 lg:p-6">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs md:text-sm lg:text-sm">
                  Email
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-900 sm:text-base md:text-lg lg:mt-2 lg:text-xl 2xl:text-2xl">
                  {email || "Not set"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
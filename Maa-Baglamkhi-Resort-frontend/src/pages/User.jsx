import React, { useEffect, useMemo, useState } from "react";
import {
  FaEdit,
  FaSearch,
  FaTrash,
  FaTimes,
  FaUserPlus,
  FaUsers,
  FaEye,
  FaShieldAlt,
  FaFolderOpen,
  FaExclamationCircle,
  FaCheckCircle,
} from "react-icons/fa";

import CreateUser from "../components/Createuser/CreateUser";
import API from "../api";

const User = () => {




  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [paginationMessage, setPaginationMessage] = useState("");
  const [page, setPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(8);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "staff",
    password: "",
  });
  const [editError, setEditError] = useState("");
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [currentUserRole, setIsCurrentUserRole] = useState("");
  const [loggedInEmail, setLoggedInEmail] = useState("");

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await API.get("/auth/me");
        setIsCurrentUserRole(String(res.data.role || "").toLowerCase());
        setLoggedInEmail(String(res.data.email || "").toLowerCase());
      } catch {
        setIsCurrentUserRole("");
        setLoggedInEmail("");
      }
    };
    fetchMe();
  }, []);

  const isAdmin = currentUserRole === "admin";

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/users");
        const apiData = Array.isArray(res.data)
          ? res.data
          : res.data.users || [];

        setError("");
        setUsers(apiData);
      } catch (err) {
        console.error("Failed to load users", err);
        setError("Unable to load users. Please check the backend connection.");
        setUsers([]);
      }
    };

    fetchUsers();
  }, []);

  const handleUserCreated = (newUser) => {
    setError("");
    setUsers((prev) => {
      const exists = prev.some((user) => user.email === newUser.email);
      if (exists) return prev;
      return [...prev, newUser];
    });
    setSuccessMessage(`${newUser.name || "User"} created successfully`);
  };

  const handleDeleteUser = async (user) => {
    if (!isAdmin) {
      setError("Sirf admin user account delete kar sakta hai.");
      return;
    }

    const id = user.id || user._id;
    if (!id) {
      setError("User ID is missing. Delete failed.");
      return;
    }

    try {
      setError("");
      await API.delete(`/users/${id}`, { skipAuthRedirect: true });
      setUsers((prev) =>
        prev.filter((item) => String(item.id || item._id) !== String(id))
      );

      setDeleteMessage(`${user.name || user.fullName || "User"} deleted successfully`);
    } catch (err) {
      console.error("Failed to delete user", err);
      const status = err.response?.status;
      if (status === 403) {
        setError("Sirf admin user account delete kar sakta hai.");
      } else if (status === 401) {
        setError("Session expire ho gayi hai ya token missing hai. Delete action roka gaya hai.");
      } else if (status === 404) {
        setUsers((prev) =>
          prev.filter(
            (item) =>
              String(item.id || item._id) !== String(id) &&
              String(item.email || "").toLowerCase() !==
                String(user.email || "").toLowerCase()
          )
        );
        setDeleteMessage(`${user.name || user.fullName || "User"} deleted successfully`);
      } else {
        setError(err.response?.data?.message || "User could not be deleted.");
      }
    }
  };

  const openEditUser = (user) => {
    if (!isAdmin) {
      setError("Sirf admin user account edit kar sakta hai.");
      return;
    }

    setError("");
    setEditError("");
    setEditingUser(user);
    setEditForm({
      name: user.name || user.fullName || user.username || "",
      email: user.email || "",
      role: String(user.role || user.userRole || "staff").toLowerCase(),
      password: "",
    });
  };

  const handleEditChange = (e) => {
    setEditError("");
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUsersPerPageChange = (size) => {
    setPaginationMessage("");
    setPage(1);
    setUsersPerPage(size);
    if (filteredUsers.length <= size) {
      setPaginationMessage("Abhi aur user nahi hain.");
    }
  };

  const handlePrevPage = () => {
    if (page === 1) {
      setPaginationMessage("Aap first page par hain.");
      return;
    }

    setPaginationMessage("");
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    if (page >= totalPages) {
      setPaginationMessage("Abhi aur user nahi hain.");
      return;
    }

    setPaginationMessage("");
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!isAdmin) {
      setEditError("Sirf admin user account edit kar sakta hai.");
      return;
    }

    const id = editingUser.id || editingUser._id;
    if (!id) {
      setEditError("User ID is missing. Update failed.");
      return;
    }

    try {
      setIsUpdatingUser(true);
      setEditError("");
      setError("");

      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      };

      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await API.put(`/users/${id}`, payload, {
        skipAuthRedirect: true,
      });

      const updatedUser = res.data?.user || { ...editingUser, ...payload, id };

      setUsers((prev) =>
        prev.map((user) =>
          String(user.id || user._id) === String(id)
            ? { ...user, ...updatedUser }
            : user
        )
      );

      setEditingUser(null);
      setSuccessMessage(`${updatedUser.name || "User"} updated successfully`);
    } catch (err) {
      console.error("Failed to update user", err);
      const status = err.response?.status;
      if (status === 403) {
        setEditError("Sirf admin user account edit kar sakta hai.");
      } else if (status === 401) {
        setEditError("Session expire ho gayi hai ya token missing hai.");
      } else {
        setEditError(err.response?.data?.message || "User could not be updated.");
      }
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const name = (user.name || user.fullName || user.username || "")
          .toString()
          .toLowerCase();
        const email = (user.email || "").toString().toLowerCase();
        const role = (user.role || user.userRole || "")
          .toString()
          .toLowerCase();
        const searchText = search.toLowerCase();

        return (
          name.includes(searchText) ||
          email.includes(searchText) ||
          role.includes(searchText)
        );
      }),
    [search, users]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / usersPerPage)),
    [filteredUsers.length, usersPerPage]
  );

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [1];

    const items = [1];
    const windowStart = Math.max(2, page - 1);
    const windowEnd = Math.min(totalPages - 1, page + 1);

    if (windowStart > 2) {
      items.push("start-ellipsis");
    }

    for (let pageNumber = windowStart; pageNumber <= windowEnd; pageNumber += 1) {
      items.push(pageNumber);
    }

    if (windowEnd < totalPages - 1) {
      items.push("end-ellipsis");
    }

    items.push(totalPages);
    return items;
  }, [page, totalPages]);

  const visibleUsers = useMemo(() => {
    const startIndex = (page - 1) * usersPerPage;
    return filteredUsers.slice(startIndex, startIndex + usersPerPage);
  }, [filteredUsers, page, usersPerPage]);

  useEffect(() => {
    setPage(1);
  }, [search, users.length, usersPerPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);







  

  const roleCount = useMemo(
    () =>
      new Set(
        users.map((user) => (user.role || user.userRole || "Unknown").toString())
      ).size,
    [users]
  );

  const getUserMeta = (user, index) => {
    const displayName =
      user.name || user.fullName || user.username || "Unknown User";
    const email = user.email || user.username || "N/A";
    const role = user.role || user.userRole || "N/A";
    const initial = displayName.toString().charAt(0).toUpperCase();
    const backendAvatar = user.avatar || user.avatarUrl || "";
    const avatarSrc = backendAvatar || "";

    return { displayName, email, role, initial, avatarSrc, index: index + 1 };
  };

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-white p-3 sm:p-6 lg:p-8">
      <div className="w-full max-w-full space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-7">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-[28px] bg-gradient-to-br from-blue-900 via-blue-800 to-blue-500 px-4 py-6 shadow-[0_25px_60px_rgba(30,58,138,0.35)] sm:px-8 sm:py-10">
          {/* dot pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          {/* wave shapes */}
          <svg
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full text-blue-500/30"
            viewBox="0 0 1440 200"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,120 C240,180 480,60 720,90 C960,120 1200,200 1440,140 L1440,200 L0,200 Z" />
          </svg>
          <svg
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-white/10"
            viewBox="0 0 1440 200"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,160 C300,100 600,180 900,130 C1150,90 1300,150 1440,110 L1440,200 L0,200 Z" />
          </svg>
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative grid gap-5 sm:gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)] lg:items-center">
            <div className="min-w-0 space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-white/15 shadow-inner backdrop-blur-md">
                  <FaUsers className="text-base sm:text-lg md:text-xl text-white" />
                </div>
                <p className="text-xs sm:text-sm md:text-[14px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.22em] md:tracking-[0.28em] text-white/80">
                  Team Directory
                </p>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <h1 className="break-words text-[26px] leading-tight text-white sm:text-[32px] md:text-[36px] lg:text-[40px] sm:leading-[1.15] font-black">
                  User management made cleaner and faster
                </h1>
                
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  disabled={!isAdmin}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-white px-5 py-3 sm:px-6 sm:py-3.5 text-sm sm:text-[16px] font-bold text-blue-900 shadow-[0_16px_35px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(0,0,0,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaUserPlus className="text-blue-600" />
                  Add New User
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { label: "Total Users", value: users.length, icon: FaUsers },
                { label: "Visible Users", value: filteredUsers.length, icon: FaEye },
                { label: "Active Roles", value: roleCount, icon: FaShieldAlt },
              ].map((item) => (
                <div
                  key={item.label}
                  className="group flex min-w-0 items-center gap-3 sm:gap-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 sm:px-5 sm:py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.14]"
                >
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-transform duration-300 group-hover:scale-105">
                    <item.icon className="text-sm sm:text-base md:text-lg" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-xs sm:text-sm md:text-[16px] font-medium text-blue-50/80">
                      {item.label}
                    </span>
                    <div className="mt-1 text-[26px] sm:text-[30px] md:text-[34px] lg:text-[42px] font-bold leading-none tracking-tight">
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MAIN CARD */}
        <section className="rounded-2xl sm:rounded-3xl border border-blue-100 bg-white p-4 shadow-[0_18px_45px_rgba(30,58,138,0.08)] transition-shadow duration-300 hover:shadow-[0_22px_55px_rgba(30,58,138,0.1)] sm:p-6 lg:p-7">
          <div>
            <div className="mb-5 sm:mb-6 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm md:text-[16px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.24em] text-blue-500">
                  User Directory
                </p>
                <h2 className="mt-2 break-words text-xl sm:text-2xl md:text-[28px] lg:text-[34px] font-black leading-tight text-blue-900">
                  Search and Manage staff
                </h2>
                
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                disabled={!isAdmin}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-900 to-blue-500 px-4 py-3 sm:px-5 sm:py-3.5 text-sm sm:text-[16px] font-bold text-white shadow-[0_14px_32px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(59,130,246,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaUserPlus />
                Add User
              </button>
            </div>

            <div className="relative w-full">
              <FaSearch className="pointer-events-none absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-blue-400 text-sm sm:text-base" />
              <input
                type="text"
                placeholder="Search users by name, email or role..."
                className="h-11 sm:h-13 md:h-14 w-full rounded-xl sm:rounded-2xl border-2 border-blue-100 bg-white pl-10 sm:pl-12 pr-4 text-sm sm:text-[16px] text-blue-900 placeholder:text-slate-400 outline-none transition-all duration-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {error ? (
              <div className="mt-4 flex items-start sm:items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-[16px] font-semibold text-blue-900 transition-all duration-300 break-words">
                <FaExclamationCircle className="mt-0.5 sm:mt-0 shrink-0 text-blue-500" />
                {error}
              </div>
            ) : null}

            {!isAdmin ? (
              <div className="mt-4 flex items-start sm:items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-[16px] font-semibold text-blue-900 break-words">
                <FaShieldAlt className="mt-0.5 sm:mt-0 shrink-0 text-blue-500" />
                Edit, create, and delete actions are allowed only for the admin account.
              </div>
            ) : null}
          </div>

          {/* DESKTOP TABLE */}
          <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-blue-100 lg:block">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-blue-50 text-[15px] uppercase tracking-[0.16em] text-blue-900">
                <tr>
                  <th className="px-5 py-4 font-bold">#</th>
                  <th className="px-5 py-4 font-bold">Profile</th>
                  <th className="px-5 py-4 font-bold">Name</th>
                  <th className="px-5 py-4 font-bold">Email</th>
                  <th className="px-5 py-4 font-bold">Role</th>
                  <th className="px-5 py-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length > 0 ? (
                  visibleUsers.map((user, index) => {
                    const meta = getUserMeta(
                      user,
                      (page - 1) * usersPerPage + index
                    );

                    return (
                      <tr
                        key={user.id || user._id || index}
                        className={`border-t border-blue-50 transition-colors duration-300 hover:bg-blue-50/70 ${
                          index % 2 === 1 ? "bg-blue-50/30" : "bg-white"
                        }`}
                      >
                        <td className="px-5 py-4 text-[16px] font-semibold text-blue-900/70">
                          {meta.index}
                        </td>
                        <td className="px-5 py-4">
                          <div className="h-11 w-11 overflow-hidden rounded-full bg-gradient-to-br from-blue-900 to-blue-500 text-white shadow-md ring-2 ring-white">
                            {meta.avatarSrc ? (
                              <img
                                src={meta.avatarSrc}
                                alt={meta.displayName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold">
                                {meta.initial || "?"}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[16px] font-semibold text-blue-900 max-w-[220px] truncate">
                          {meta.displayName}
                        </td>
                        <td className="px-5 py-4 text-[16px] text-slate-600 max-w-[260px] truncate">
                          {meta.email}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[15px] font-bold text-blue-700">
                            {meta.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditUser(user)}
                              disabled={!isAdmin}
                              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[15px] font-bold text-blue-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <FaEdit />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              disabled={!isAdmin}
                              className="inline-flex items-center gap-2 rounded-xl border border-blue-900/20 bg-blue-900/5 px-3 py-2 text-[15px] font-bold text-blue-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-900/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <FaTrash />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-5 py-16">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                          <FaFolderOpen className="text-2xl" />
                        </div>
                        <p className="text-[18px] font-bold text-blue-900">
                          No users found
                        </p>
                        <p className="text-[15px] text-slate-500">
                          Try adjusting your search or add a new user.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE / TABLET CARDS */}
          <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:hidden">
          {visibleUsers.length > 0 ? (
            visibleUsers.map((user, index) => {
              const meta = getUserMeta(
                user,
                (page - 1) * usersPerPage + index
              );

              return (
                <div
                  key={user.id || user._id || index}
                  className="flex h-full min-w-0 flex-col rounded-2xl border border-blue-100 bg-white p-3 sm:p-4 shadow-[0_12px_30px_rgba(30,58,138,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(30,58,138,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-900 to-blue-500 text-white shadow-md ring-2 ring-white">
                      {meta.avatarSrc ? (
                        <img
                          src={meta.avatarSrc}
                          alt={meta.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm sm:text-base font-bold">
                          {meta.initial || "?"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm sm:text-[16px] font-bold text-blue-900">
                        {meta.displayName}
                      </div>
                      <div className="truncate text-xs sm:text-[16px] text-slate-500">
                        {meta.email}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs sm:text-[15px] font-semibold text-slate-500">
                      User #{meta.index}
                    </span>
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 sm:px-3 text-xs sm:text-[15px] font-bold text-blue-700">
                      {meta.role}
                    </span>
                  </div>
                  <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditUser(user)}
                      disabled={!isAdmin}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-blue-200 bg-blue-50 px-2 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-[15px] font-bold text-blue-700 transition-all duration-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaEdit />
                      Edit User
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      disabled={!isAdmin}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-blue-900/20 bg-blue-900/5 px-2 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-[15px] font-bold text-blue-900 transition-all duration-300 hover:bg-blue-900/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaTrash />
                      Delete User
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-10 sm:py-14 text-center shadow-[0_12px_30px_rgba(30,58,138,0.06)]">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <FaFolderOpen className="text-xl sm:text-2xl" />
              </div>
              <p className="text-base sm:text-[18px] font-bold text-blue-900">No users found</p>
              <p className="text-xs sm:text-[15px] text-slate-500">
                Try adjusting your search or add a new user.
              </p>
            </div>
          )}
          </div>

          {filteredUsers.length > 0 ? (
            <div className="mt-5 sm:mt-6 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-xs sm:text-sm md:text-[16px] text-slate-500">
                Showing{" "}
                <span className="font-bold text-blue-900">
                  {filteredUsers.length ? (page - 1) * usersPerPage + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-bold text-blue-900">
                  {Math.min(page * usersPerPage, filteredUsers.length)}
                </span>{" "}
                of{" "}
                <span className="font-bold text-blue-900">
                  {filteredUsers.length}
                </span>{" "}
                users
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 lg:justify-end">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={page === 1}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm md:text-[16px] font-bold text-blue-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                Prev
              </button>
              <div className="flex flex-wrap items-center gap-1 rounded-full border border-blue-100 bg-blue-50/50 px-1.5 py-1.5">
                {[5, 10, 25, 50].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleUsersPerPageChange(size)}
                    className={`rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-[15px] font-bold transition-all duration-300 ${
                      usersPerPage === size
                        ? "bg-gradient-to-r from-blue-900 to-blue-500 text-white shadow-[0_10px_22px_rgba(59,130,246,0.3)]"
                        : "text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {paginationItems.map((item) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setPaginationMessage("");
                        setPage(item);
                      }}
                      className={`h-8 min-w-8 sm:h-10 sm:min-w-10 rounded-full px-2 sm:px-3 text-xs sm:text-[15px] font-bold transition-all duration-300 ${
                        page === item
                          ? "bg-gradient-to-r from-blue-900 to-blue-500 text-white shadow-[0_10px_22px_rgba(59,130,246,0.3)]"
                          : "border border-blue-100 bg-white text-blue-700 hover:bg-blue-50"
                      }`}
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={item}
                      className="px-1 text-xs sm:text-[15px] font-bold tracking-[0.2em] text-blue-300"
                    >
                      ...
                    </span>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={page === totalPages}
                className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm md:text-[16px] font-bold text-blue-700 shadow-[0_10px_22px_rgba(59,130,246,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                Next
              </button>
              </div>
            </div>
          ) : null}

          {paginationMessage ? (
            <div className="mt-4 flex justify-center sm:justify-end">
              <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 sm:px-4 text-xs sm:text-[15px] font-semibold text-blue-900 text-center">
                <FaExclamationCircle className="shrink-0 text-blue-500" />
                {paginationMessage}
              </div>
            </div>
          ) : null}
        </section>

        {showCreateModal && (
          <CreateUser
            onClose={() => setShowCreateModal(false)}
            onUserCreated={handleUserCreated}
          />
        )}

        {editingUser ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/50 px-3 sm:px-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl sm:rounded-3xl border border-blue-100 bg-white p-4 shadow-[0_30px_90px_rgba(30,58,138,0.3)] sm:p-6 md:p-8">
              <div className="mb-5 sm:mb-6 flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm md:text-[16px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.24em] text-blue-500">
                    User Update
                  </p>
                  <h2 className="mt-1 text-xl sm:text-2xl md:text-[28px] lg:text-[32px] font-black text-blue-900 break-words">
                    Edit user
                  </h2>
                  <p className="mt-2 text-sm sm:text-[16px] leading-6 sm:leading-7 text-slate-500">
                   Update the user's name, email, role, and optional password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setEditError("");
                  }}
                  className="shrink-0 rounded-full border border-blue-100 bg-white p-2.5 sm:p-3 text-blue-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50"
                >
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-3 sm:space-y-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  required
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="w-full rounded-xl sm:rounded-2xl border-2 border-blue-100 bg-white px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-[16px] text-blue-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  required
                  value={editForm.email}
                  onChange={handleEditChange}
                  className="w-full rounded-xl sm:rounded-2xl border-2 border-blue-100 bg-white px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-[16px] text-blue-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <input
                  type="password"
                  name="password"
                  placeholder="New Password (optional)"
                  value={editForm.password}
                  onChange={handleEditChange}
                  className="w-full rounded-xl sm:rounded-2xl border-2 border-blue-100 bg-white px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-[16px] text-blue-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <select
                  name="role"
                  value={editForm.role}
                  onChange={handleEditChange}
                  className="w-full rounded-xl sm:rounded-2xl border-2 border-blue-100 bg-white px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-[16px] text-blue-900 outline-none transition-all duration-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="accountant">Accountant</option>
                  <option value="waiter">Waiter</option>
                  <option value="kitchen">Kitchen</option>
                </select>

                {editError ? (
                  <div className="flex items-start sm:items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-[16px] font-semibold text-blue-900 break-words">
                    <FaExclamationCircle className="mt-0.5 sm:mt-0 shrink-0 text-blue-500" />
                    {editError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-900 to-blue-500 px-4 py-3 sm:px-5 sm:py-4 text-sm sm:text-[16px] font-bold text-white shadow-[0_18px_40px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(59,130,246,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaEdit />
                  {isUpdatingUser ? "Updating..." : "Update User"}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {successMessage ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/50 px-3 sm:px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-blue-100 bg-white p-5 text-center shadow-[0_30px_90px_rgba(30,58,138,0.3)] sm:p-8">
              <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-blue-50 shadow-[0_18px_40px_rgba(59,130,246,0.18)]">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-900 to-blue-500 text-white shadow-md">
                  <FaCheckCircle className="text-base sm:text-lg" />
                </div>
              </div>
              <p className="mt-4 sm:mt-5 text-xs sm:text-sm md:text-[16px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.24em] text-blue-500">
                User Created
              </p>
              <h3 className="mt-2 break-words text-xl sm:text-2xl md:text-[26px] lg:text-[32px] font-black leading-tight text-blue-900">
                {successMessage}
              </h3>
              <p className="mt-3 text-sm sm:text-[16px] leading-6 sm:leading-7 text-slate-500">
                The new team member has been successfully added to the user directory.
              </p>
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="mt-5 sm:mt-6 inline-flex w-full sm:w-auto items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-900 to-blue-500 px-5 py-3 sm:px-6 sm:py-3.5 text-sm sm:text-[16px] font-bold text-white shadow-[0_16px_35px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(59,130,246,0.4)]"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {deleteMessage ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/50 px-3 sm:px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-blue-100 bg-white p-5 text-center shadow-[0_30px_90px_rgba(30,58,138,0.3)] sm:p-8">
              <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-blue-50 shadow-[0_18px_40px_rgba(30,58,138,0.16)]">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-900 to-blue-500 text-white shadow-md">
                  <FaTrash className="text-sm sm:text-base" />
                </div>
              </div>
              <p className="mt-4 sm:mt-5 text-xs sm:text-sm md:text-[16px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.24em] text-blue-500">
                User Deleted
              </p>
              <h3 className="mt-2 break-words text-xl sm:text-2xl md:text-[26px] lg:text-[32px] font-black leading-tight text-blue-900">
                {deleteMessage}
              </h3>
              <p className="mt-3 text-sm sm:text-[16px] leading-6 sm:leading-7 text-slate-500">
                The selected user has been successfully removed from the directory.
              </p>
              <button
                type="button"
                onClick={() => setDeleteMessage("")}
                className="mt-5 sm:mt-6 inline-flex w-full sm:w-auto items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-900 to-blue-500 px-5 py-3 sm:px-6 sm:py-3.5 text-sm sm:text-[16px] font-bold text-white shadow-[0_16px_35px_rgba(30,58,138,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(30,58,138,0.36)]"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default User;
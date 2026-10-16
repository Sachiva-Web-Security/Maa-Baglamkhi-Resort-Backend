// src/components/Hotel/Room.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  KeyRound,
  Wrench,
  Snowflake,
  Wind,
  Crown,
  Sparkles,
  Gem,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  BadgeCheck,
  ListChecks,
  Trash2,
} from "lucide-react";

import API from "../../api";
import { expandBookings } from "../Dashboard/stayoverUtils";
import BookingCancelAction from "./BookingCancelAction";
import {
  getBookingDraft,
  getStoredBookingCode,
  getStoredBookingId,
  setBookingDraft,
  setStoredBookingId,
} from "./bookingSession";

// ─── Default categories (used as fallback if API is slow) ─────────────────────
// Room.jsx
export const DEFAULT_ROOMS = [
  { id: 2, name: "NON-AC ROOM",          defaultPrice: 1500, unitLabel: "PER NIGHT" },
  { id: 3, name: "SUPER DELUXE ROOM",    defaultPrice: 3000, unitLabel: "PER NIGHT" }, // 🔧 changed from "DELUXE ROOM"
  { id: 4, name: "EXECUTIVE ROOM ",      defaultPrice: 4000, unitLabel: "PER NIGHT" },
  { id: 5, name: "SUPER EXECUTIVE ROOM", defaultPrice: 5000, unitLabel: "PER NIGHT" },
  { id: 6, name: "SUITE ROOM",           defaultPrice: 800,  unitLabel: "PER BED"   },
];

// ─── Premium field / control classes (Blue & White theme) ─────────────────────
const fieldCls =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const pickerButtonCls =
  "w-full rounded-2xl border border-blue-100 bg-white px-4 py-3.5 text-left text-[15px] text-slate-900 shadow-sm outline-none transition hover:border-blue-300 hover:shadow-md focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const formatPriceText = (price, unitLabel) => `Rs ${price} ${unitLabel}`;
const ROOM_LIST_PAGE_SIZE = 8;

// ─── Icon chosen per room category (visual only, no logic impact) ─────────────
const getCategoryIcon = (name = "") => {
  const key = name.toLowerCase();
  if (key.includes("non-ac") || key.includes("non ac")) return Wind;
  if (key.includes("super deluxe")) return Crown;
  if (key.includes("suite")) return Gem;
  if (key.includes("dorm")) return Users;
  if (key.includes("deluxe")) return Sparkles;
  if (key.includes("ac")) return Snowflake;
  return Building2;
};

// ─── Room status helpers ───────────────────────────────────────────────────────
// Returns "blocked" | "occupied" | "booked" | "available"
// Priority: blocked > booked (active booking) > occupied > available

const getRoomAvailabilityState = (
  roomNo,
  bookedRoomNumbers,    // Set — rooms from active bookings (room_tariff)
  blockedRoomNumbers,   // Set — rooms blocked for maintenance
  inventoryStatusMap,   // Map roomNumber → status string from hotel_room_inventory
) => {
  const key = String(roomNo || "").trim().toLowerCase();
  if (!key) return "available";

  // 1. Check maintenance block (highest priority)
  if (blockedRoomNumbers.has(key)) return "blocked";

  // 2. Check active bookings FIRST — only "booked" if there's an actual active booking
  if (bookedRoomNumbers.has(key)) return "booked";

  // 3. Check inventory operational status
  const inventoryStatus = String(
    inventoryStatusMap.get(key) || "",
  ).toLowerCase();

  if (inventoryStatus.includes("blocked") || inventoryStatus.includes("out of service"))
    return "blocked";
  if (inventoryStatus.includes("occupied"))
    return "occupied";

  return "available";
};

// Badge UI per state (Emerald = Available, Rose = Blocked, Violet = Booked, Amber = Occupied)
const AVAILABILITY_BADGE = {
  blocked: {
    label:    "Blocked",
    classes:  "bg-rose-100 text-rose-600",
    pill:     "border-rose-200 bg-rose-50 text-rose-700",
    dot:      "bg-rose-500",
    disabled: true,
  },
  occupied: {
    label:    "Occupied",
    classes:  "bg-amber-100 text-amber-600",
    pill:     "border-amber-200 bg-amber-50 text-amber-700",
    dot:      "bg-amber-500",
    disabled: true,
  },
  booked: {
    label:    "Booked",
    classes:  "bg-violet-100 text-violet-600",
    pill:     "border-violet-200 bg-violet-50 text-violet-700",
    dot:      "bg-violet-500",
    disabled: true,
  },
  available: {
    label:    "Available",
    classes:  "bg-emerald-100 text-emerald-600",
    pill:     "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot:      "bg-emerald-500",
    disabled: false,
  },
};

// ─── Main Component ────────────────────────────────────────────────────────────
const Room = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const noticeDialogRef = useRef(null);
  const bookingId   = location.state?.bookingId   || getStoredBookingId();
  const bookingCode = location.state?.bookingCode || getStoredBookingCode();
  const bookingRef  = bookingCode || bookingId;

  const [roomCatalog,    setRoomCatalog]    = useState(DEFAULT_ROOMS);
  const roomDraft = getBookingDraft("room") || {};

  const [activeRoom,     setActiveRoom]     = useState(roomDraft.activeRoom ?? null);
  const [selectedRooms,  setSelectedRooms]  = useState(roomDraft.selectedRooms || {});
  const [roomOptions,    setRoomOptions]    = useState(roomDraft.roomOptions   || {});
  const [inputValue,     setInputValue]     = useState(roomDraft.inputValue    || {});
  const [priceInputs,    setPriceInputs]    = useState(roomDraft.priceInputs   || {});
  const [pickerValues,   setPickerValues]   = useState(roomDraft.pickerValues  || {});
  const [openPickers,    setOpenPickers]    = useState({});
  const [roomListPages,  setRoomListPages]  = useState(roomDraft.roomListPages || {});
  const [notice,         setNotice]         = useState({
    open: false,
    title: "",
    message: "",
    tone: "info",
  });

  // BUG FIX: separate state for all three unavailability sources
  const [activeBookings,       setActiveBookings]       = useState([]);
  const [inventoryStatusMap,   setInventoryStatusMap]   = useState(new Map()); // roomNumber → status
  const [blockedRoomNumbers,   setBlockedRoomNumbers]   = useState(new Set()); // from hotel_room_blocks

  useEffect(() => {
    if (bookingId) setStoredBookingId(bookingId);
  }, [bookingId]);

  // ─── Load active bookings (to detect rooms in confirmed/checked-in bookings) ──
  useEffect(() => {
    let cancelled = false;

    const loadActiveBookings = async () => {
      try {
        const response = await API.get("/hotel/all-bookings");
        const rows = expandBookings(response.data);

        const next = rows.filter((booking) => {
          const status = String(booking.bookingStatus || "").toLowerCase();
          const isCurrent = bookingId &&
            String(booking.bookingId) === String(bookingId);
          const isClosed  = status.includes("check out")  ||
                            status.includes("checked out") ||
                            status.includes("cancel");
          return !isCurrent && !isClosed;
        });

        if (!cancelled) setActiveBookings(next);
      } catch (err) {
        console.error("Failed to load active bookings", err);
      }
    };

    loadActiveBookings();
    const intervalId = window.setInterval(loadActiveBookings, 15_000);
    window.addEventListener("focus", loadActiveBookings);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadActiveBookings);
    };
  }, [bookingId]);

  // ─── BUG FIX: Load active maintenance blocks ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadBlocks = async () => {
      try {
        const response = await API.get("/hotel/room-blocks?status=Active");
        const blocks = Array.isArray(response.data) ? response.data : [];
        if (!cancelled) {
          setBlockedRoomNumbers(
            new Set(
              blocks.map((b) => String(b.room_number || "").trim().toLowerCase()),
            ),
          );
        }
      } catch (err) {
        // Non-fatal — if route not yet deployed, ignore
        console.warn("Room blocks fetch skipped:", err.message);
      }
    };

    loadBlocks();
    return () => { cancelled = true; };
  }, []);

  // ─── Load room setup from inventory (with status fix) ─────────────────────────
  useEffect(() => {
    const loadRoomSetup = async () => {
      try {
        const response   = await API.get("/hotel/rooms/setup");
        const setupRows  = Array.isArray(response.data) ? response.data : [];

        // ROOT CAUSE (issue 2): the cards used to be driven by the hard-coded
        // DEFAULT_ROOMS ids (2, 3, 4, 5, 6), which do not exist in the
        // `room_categories` table — the real ids are 1 and 9003..9008. Two
        // things followed from that:
        //   * roomOptions is keyed by the BACKEND id, so a card looking up
        //     roomOptions[2] got undefined and rendered zero rooms;
        //   * handleAddOption() POSTs { categoryId: room.id }, so adding a room
        //     under one of those cards hit the rooms.category_id foreign key
        //     and failed with "Failed to add room".
        // Net effect: no room type showed its rooms and none could be added to.
        //
        // The catalog is now built from the live categories themselves, always
        // using the backend's own id — never a remembered one, because a card
        // that keeps a stale id stays un-addable. DEFAULT_ROOMS is kept purely
        // as a price/unit fallback for a category the backend left blank.
        setRoomCatalog((prev) => {
          if (!setupRows.length) return prev;
          return setupRows.map((category) => {
            const fallback = DEFAULT_ROOMS.find((d) => d.name === category.name);
            return {
              id: Number(category.id),
              name: category.name,
              defaultPrice: Number(
                category.defaultPrice ?? fallback?.defaultPrice ?? 0,
              ),
              unitLabel: category.unitLabel || fallback?.unitLabel || "PER NIGHT",
            };
          });
        });

        const mappedOptions = {};
        const mappedPrices  = {};

        // BUG FIX: build inventoryStatusMap from roomDetails
        const statusMap = new Map();

        setupRows.forEach((category) => {
          mappedOptions[category.id] = Array.isArray(category.rooms)
            ? category.rooms
            : [];
          mappedPrices[category.id] = String(
            Number(category.defaultPrice || 0),
          );

          // roomDetails is the new field from fixed getRoomSetup
          if (Array.isArray(category.roomDetails)) {
            category.roomDetails.forEach((rd) => {
              if (rd.roomNumber) {
                statusMap.set(
                  String(rd.roomNumber).trim().toLowerCase(),
                  rd.status || "Available",
                );
              }
            });
          } else {
            // Fallback: if backend not yet updated, use basic rooms list
            (category.rooms || []).forEach((rn) => {
              statusMap.set(String(rn).trim().toLowerCase(), "Available");
            });
          }
        });

        // Live data must win over any restored draft. The old spread order
        // (`{ ...mappedOptions, ...prev }`) let a persisted draft keyed by the
        // stale DEFAULT_ROOMS ids shadow the real categories, so a room added
        // on another machine appeared to vanish here. Take the fresh values
        // first and only fall back to the draft for ids the response omitted.
        setRoomOptions((prev) => ({ ...prev, ...mappedOptions }));
        setPriceInputs((prev) => ({ ...prev, ...mappedPrices }));
        setInventoryStatusMap(statusMap);
      } catch (err) {
        console.error("Failed to load room setup", err);
        showNotice("Unable to load room setup right now. Please try again.", "Setup Error", "error");
      }
    };

    loadRoomSetup();
  }, []);

  // Persist draft on every change
  useEffect(() => {
    setBookingDraft("room", {
      activeRoom,
      selectedRooms,
      roomOptions,
      inputValue,
      priceInputs,
      pickerValues,
      roomListPages,
      roomTypeMap: roomCatalog.reduce((acc, room) => {
        acc[String(room.id)] = room.name;
        return acc;
      }, {}),
      roomCatalog,
    });
  }, [activeRoom, selectedRooms, roomOptions, inputValue, priceInputs, pickerValues, roomListPages, roomCatalog]);

  // ─── Derived sets ──────────────────────────────────────────────────────────────
  // Set of rooms with active bookings (from room_tariff via getAllBookings)
  const bookedRoomNumbers = useMemo(() => {
    const locked = new Set();
    activeBookings.forEach((booking) => {
      if (booking.roomNumber) {
        locked.add(String(booking.roomNumber).trim().toLowerCase());
      }
    });
    return locked;
  }, [activeBookings]);

  const selectedRoomCount = useMemo(
    () =>
      Object.values(selectedRooms).reduce(
        (sum, rooms) => sum + rooms.length, 0,
      ),
    [selectedRooms],
  );

  // ─── Availability helpers ──────────────────────────────────────────────────────
  const getRoomState = useCallback(
    (roomNo) =>
      getRoomAvailabilityState(
        roomNo,
        bookedRoomNumbers,
        blockedRoomNumbers,
        inventoryStatusMap,
      ),
    [bookedRoomNumbers, blockedRoomNumbers, inventoryStatusMap],
  );

  // A room is "unavailable" if it's blocked, occupied, or already booked
  const isRoomUnavailable = useCallback(
    (roomNo) => getRoomState(roomNo) !== "available",
    [getRoomState],
  );

  const getAvailableRoomsForType = (roomId) =>
    (roomOptions[roomId] || []).filter((item) => !isRoomUnavailable(item));

  const showNotice = useCallback((message, title = "Notice", tone = "info") => {
    setNotice({
      open: true,
      title,
      message,
      tone,
    });
  }, []);

  useEffect(() => {
    if (!notice.open) return undefined;

    const handleNoticeKeydown = (event) => {
      if (event.key === "Escape") {
        setNotice((prev) => ({ ...prev, open: false }));
      }
    };

    const dialogNode = noticeDialogRef.current;
    dialogNode?.focus();
    window.addEventListener("keydown", handleNoticeKeydown);

    return () => {
      window.removeEventListener("keydown", handleNoticeKeydown);
    };
  }, [notice.open]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleAvailability = (index) => {
    setActiveRoom(activeRoom === index ? null : index);
  };

  const normalize = (val) => val.trim().toLowerCase();

  // Extract numeric part from room strings for duplicate detection
  // e.g. "101" → 101, "no101" → 101, "A-205" → 205
  const extractRoomNumber = (str) => {
    const match = String(str).match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const findExistingRoom = (value) => {
    const inputNum = extractRoomNumber(value);
    if (inputNum === null) return null;

    for (const [roomId, options] of Object.entries(roomOptions)) {
      if (options.some((item) => extractRoomNumber(item) === inputNum)) {
        const roomName = roomCatalog.find(
          (room) => room.id === Number(roomId),
        )?.name;
        return roomName;
      }
    }
    return null;
  };

  const isDuplicateInState = (value) => {
    const inputStr = String(value).trim().toLowerCase();
    const inputNum = extractRoomNumber(value);
    if (inputNum === null) {
      // No number — check exact string match
      return Object.values(roomOptions).some((options) =>
        options.some((r) => String(r).trim().toLowerCase() === inputStr),
      );
    }
    // Check numeric match (handles "101" vs "no101" vs "No-101" etc.)
    return Object.values(roomOptions).some((options) =>
      options.some((r) => extractRoomNumber(r) === inputNum),
    );
  };

  const handleAddOption = async (roomId) => {
    const value = (inputValue[roomId] || "").trim();
    if (!value) return;

    const roomState = getRoomState(value);
    if (roomState === "blocked") {
      showNotice(`Room ${value} is blocked for maintenance and cannot be booked.`, "Room Unavailable", "error");
      return;
    }
    if (roomState === "occupied" || roomState === "booked") {
      showNotice(`Room ${value} is already booked. It can be selected again after checkout.`, "Room Unavailable", "error");
      return;
    }

    // Check if already exists in local state (covers duplicate numbers regardless of format)
    if (isDuplicateInState(value)) {
      showNotice(`Room ${value} already exists in inventory. Duplicates are not allowed.`, "Duplicate Room", "warning");
      return;
    }

    try {
      const response = await API.post("/hotel/rooms", { categoryId: roomId, roomNumber: value });
      const room = response.data.room;

      if (room) {
        setRoomOptions((prev) => {
          const current = prev[roomId] || [];
          if (current.some((r) => r === room.roomNumber)) return prev;
          const nextRooms = [...current, room.roomNumber];
          const totalPages = Math.max(1, Math.ceil(nextRooms.length / ROOM_LIST_PAGE_SIZE));
          setRoomListPages((pages) => ({ ...pages, [roomId]: totalPages }));
          return {
            ...prev,
            [roomId]: nextRooms,
          };
        });
        setInputValue((prev) => ({ ...prev, [roomId]: "" }));
      } else {
        showNotice("Unexpected response from server. Room may not have been added.", "Add Room Failed", "error");
      }
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.message || "Unable to add the room right now.";
      showNotice(message, "Add Room Failed", "error");
    }
  };

  const handleDeleteRoom = async (roomId, roomNumber) => {
    const confirmed = window.confirm(
      `Delete room ${roomNumber} from inventory? This cannot be undone.`,
    );
    if (!confirmed) return;

    // Helper: remove room from all relevant UI state
    const removeFromUI = () => {
      setRoomOptions((prev) => {
        const nextRooms = (prev[roomId] || []).filter((r) => r !== roomNumber);
        const totalPages = Math.max(1, Math.ceil(nextRooms.length / ROOM_LIST_PAGE_SIZE));
        setRoomListPages((current) => ({ ...current, [roomId]: totalPages }));
        return { ...prev, [roomId]: nextRooms };
      });
      setSelectedRooms((prev) => {
        const current = prev[roomId] || [];
        if (!current.includes(roomNumber)) return prev;
        return { ...prev, [roomId]: current.filter((r) => r !== roomNumber) };
      });
      setPickerValues((prev) =>
        prev[roomId] === roomNumber ? { ...prev, [roomId]: "" } : prev,
      );
    };

    try {
      const response = await API.delete(`/hotel/rooms/${encodeURIComponent(roomNumber)}`);

      // 200 success: room was in DB and is now deleted
      if (response.data && response.data.room) {
        removeFromUI();
        showNotice(`Room ${roomNumber} deleted successfully.`, "Room Deleted", "info");
        return;
      }
    } catch (err) {
      // 404 "not found": room doesn't exist in DB (phantom room from old bug)
      // Remove it from UI anyway — it was never in the database
      if (err.response?.status === 404) {
        removeFromUI();
        showNotice(
          `Room ${roomNumber} removed from view. (It was not found in the database — likely a stale entry.)`,
          "Room Cleaned Up",
          "info",
        );
        return;
      }

      // Other errors (500, network): show error, don't touch UI
      console.error("Delete room error:", err);
      const message =
        err.response?.data?.message ||
        "Unable to delete the room. Please try again.";
      showNotice(message, "Delete Room Failed", "error");
    }
  };

  const handlePriceSave = async (roomId) => {
    try {
      await API.put(`/hotel/rooms/category/${roomId}/price`, {
        defaultPrice: priceInputs[roomId],
      });
      setRoomCatalog((prev) =>
        prev.map((room) =>
          room.id === roomId
            ? { ...room, defaultPrice: Number(priceInputs[roomId] || 0) }
            : room,
        ),
      );
    } catch (err) {
      console.error(err);
      showNotice(err.response?.data?.message || "Unable to update the room price right now.", "Price Update Failed", "error");
    }
  };

  const handleSelect = (roomId, value) => {
    const roomState = getRoomState(value);
    if (roomState === "blocked") {
      showNotice(`Room ${value} is blocked for maintenance.`, "Room Unavailable", "error");
      return;
    }
    if (roomState === "occupied" || roomState === "booked") {
      showNotice(`Room ${value} is already booked.`, "Room Unavailable", "error");
      return;
    }

    setSelectedRooms((prev) => {
      const current = prev[roomId] || [];
      const isCurrentlySelected = current.includes(value);

      if (!isCurrentlySelected) {
        const existingSelection = Object.entries(prev).find(
          ([existingRoomId, values]) =>
            Number(existingRoomId) !== Number(roomId) &&
            values.includes(value),
        );
        if (existingSelection) {
          const roomTypeName =
            roomCatalog.find(
              (room) => Number(room.id) === Number(existingSelection[0]),
            )?.name || `Type ${existingSelection[0]}`;
          showNotice(`Room ${value} is already selected in ${roomTypeName}.`, "Already Selected", "warning");
          return prev;
        }
      }

      const updated = current.includes(value)
        ? current.filter((rv) => rv !== value)
        : [...current, value];

      return { ...prev, [roomId]: updated };
    });
  };

  const handleProceed = () => {
    if (!Object.values(selectedRooms).some((rooms) => rooms.length > 0)) {
      showNotice("Please select at least one room before proceeding.", "Selection Required", "warning");
      return;
    }

    const roomTypeMap = roomCatalog.reduce((acc, room) => {
      acc[String(room.id)] = room.name;
      return acc;
    }, {});

    navigate("/hotel/pax", {
      state: {
        bookingId,
        bookingCode,
        roomOptions,
        selectedRooms,
        roomTypeMap,
        roomCatalog,
      },
    });
  };

  const handlePickAvailableRoom = (roomId, value) => {
    if (!value) return;
    handleSelect(roomId, value);
    setPickerValues((prev) => ({ ...prev, [roomId]: "" }));
    setOpenPickers((prev) => ({ ...prev, [roomId]: false }));
  };

  // ─── Summary bar stats ─────────────────────────────────────────────────────────
  const allRoomNumbers = useMemo(() => {
    return Object.values(roomOptions).flat();
  }, [roomOptions]);

  const availableCount = useMemo(
    () => allRoomNumbers.filter((rn) => getRoomState(rn) === "available").length,
    [allRoomNumbers, getRoomState],
  );
  const blockedCount = useMemo(
    () => allRoomNumbers.filter((rn) => ["blocked", "occupied"].includes(getRoomState(rn))).length,
    [allRoomNumbers, getRoomState],
  );

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-white p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12">
      <div className="mx-auto w-full max-w-[1800px] space-y-5 sm:space-y-6 lg:space-y-8">

        {/* Hero */}
        <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-blue-950 via-blue-700 to-sky-500 px-5 py-7 text-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:rounded-[32px] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          {/* Abstract wave / glow decoration */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
            <div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
            <svg
              className="absolute bottom-0 left-0 w-full opacity-20"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path
                d="M0,60 C300,120 900,0 1200,60 L1200,120 L0,120 Z"
                fill="rgba(255,255,255,0.25)"
              />
            </svg>
            <div className="absolute right-16 top-10 h-2 w-2 rounded-full bg-white/70 shadow-[0_0_18px_6px_rgba(255,255,255,0.35)]" />
            <div className="absolute right-32 top-24 h-1.5 w-1.5 rounded-full bg-white/50 shadow-[0_0_14px_4px_rgba(255,255,255,0.3)]" />
          </div>

          <div className="relative grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(280px,380px)] md:items-center lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,540px)]">
            <div className="flex items-start gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur sm:flex">
                <Building2 size={30} className="text-cyan-100" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-cyan-200 sm:text-[13px]">
                  Room Selection
                </p>
                <h1 className="mt-3 text-[20px] font-black leading-tight tracking-tight sm:text-[26px] md:text-[30px] lg:text-[34px]">
                  Pick available rooms for this booking
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="min-w-0 rounded-3xl border border-white/15 bg-white/10 px-4 py-5 text-center shadow-inner backdrop-blur-md transition hover:bg-white/[0.14]">
                <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                  <KeyRound size={22} className="text-cyan-100" />
                </div>
                <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-cyan-100/80">Booking ID</div>
                <div className="mt-2 truncate text-[26px] font-black leading-none sm:text-[32px]">{bookingRef || "—"}</div>
              </div>
              <div className="min-w-0 rounded-3xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-5 text-center shadow-inner backdrop-blur-md transition hover:bg-emerald-400/[0.16]">
                <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/20">
                  <CheckCircle2 size={22} className="text-emerald-200" />
                </div>
                <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-emerald-200">Available</div>
                <div className="mt-2 text-[26px] font-black leading-none text-emerald-100 sm:text-[32px]">{availableCount}</div>
              </div>
              <div className="min-w-0 rounded-3xl border border-rose-300/20 bg-rose-400/10 px-4 py-5 text-center shadow-inner backdrop-blur-md transition hover:bg-rose-400/[0.16]">
                <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-400/20">
                  <Wrench size={22} className="text-rose-200" />
                </div>
                <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-rose-200">Unavailable</div>
                <div className="mt-2 text-[26px] font-black leading-none text-rose-100 sm:text-[32px]">{blockedCount}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-4 shadow-sm sm:px-5">
          <span className="text-[15px] font-black text-slate-900">Legend</span>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(AVAILABILITY_BADGE).map(([state, meta]) => (
              <span
                key={state}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-bold transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${meta.pill}`}
              >
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        {/* Room category cards */}
        <section className="space-y-5 sm:space-y-6">
          {roomCatalog.map((room, index) => {
            const CategoryIcon = getCategoryIcon(room.name);
            return (
              <div
                key={room.id}
                className="overflow-hidden rounded-[24px] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-100/40 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl sm:rounded-[30px] sm:p-7 lg:p-8"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-600 shadow-md shadow-blue-200 sm:h-[44px] sm:w-[44px]">
                        <CategoryIcon size={24} className="text-white" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-[18px] font-black tracking-tight text-slate-900 sm:text-[22px] lg:text-[24px]">
                            {room.name}
                          </h3>
                          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[13px] font-bold text-blue-700">
                            Seasonal
                          </span>
                          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[13px] font-bold text-blue-700">
                            {formatPriceText(room.defaultPrice, room.unitLabel)}
                          </span>
                        </div>
                        <p className="max-w-3xl text-[14px] font-medium leading-6 text-slate-500 sm:text-[15px] md:text-[16px]">
                          Set the room price first, then open availability to select, review, and add room numbers from one place.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAvailability(index)}
                      className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-600 px-6 text-[15px] font-bold text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl md:w-auto"
                    >
                      {activeRoom === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      {activeRoom === index ? "Hide Rooms" : "Check Availability"}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <div className="rounded-3xl border border-blue-100 bg-blue-50/60 px-5 py-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 shadow shadow-blue-200">
                        <Building2 size={18} className="text-white" />
                      </div>
                      <div className="mt-3 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        Total Rooms
                      </div>
                      <div className="mt-1 text-[32px] font-black leading-none text-slate-900 sm:text-[36px]">
                        {(roomOptions[room.id] || []).length}
                      </div>
                      <div className="mt-1.5 text-[13px] font-semibold text-slate-400">
                        Room inventory
                      </div>
                    </div>
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 px-5 py-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-400 shadow shadow-emerald-200">
                        <KeyRound size={18} className="text-white" />
                      </div>
                      <div className="mt-3 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        Available
                      </div>
                      <div className="mt-1 text-[32px] font-black leading-none text-slate-900 sm:text-[36px]">
                        {getAvailableRoomsForType(room.id).length}
                      </div>
                      <div className="mt-1.5 text-[13px] font-semibold text-slate-400">
                        Ready to assign
                      </div>
                    </div>
                    <div className="rounded-3xl border border-blue-100 bg-blue-50/60 px-5 py-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 shadow shadow-blue-200">
                        <ListChecks size={18} className="text-white" />
                      </div>
                      <div className="mt-3 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        Selected
                      </div>
                      <div className="mt-1 text-[32px] font-black leading-none text-slate-900 sm:text-[36px]">
                        {selectedRooms[room.id]?.length || 0}
                      </div>
                      <div className="mt-1.5 text-[13px] font-semibold text-slate-400">
                        Chosen for booking
                      </div>
                    </div>
                  </div>

                  {/* Expanded availability panel */}
                  {activeRoom === index && (
                    <div className="rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-4 sm:rounded-[26px] sm:p-6 lg:p-7">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[16px] font-black uppercase tracking-[0.2em] text-slate-900">
                            Room Availability
                          </div>
                          <div className="mt-1.5 text-[14px] font-semibold text-slate-500 sm:text-[15px]">
                            {getAvailableRoomsForType(room.id).length} room(s) ready for booking
                          </div>
                        </div>
                        <span className="rounded-full border border-blue-200 bg-white px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.14em] text-blue-700 shadow-sm">
                          {room.name}
                        </span>
                      </div>

                      {/* Quick-pick available rooms dropdown */}
                      <div className="grid gap-3 lg:max-w-[760px] lg:grid-cols-[minmax(0,1fr)_170px_150px] lg:items-stretch">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenPickers((prev) => ({ ...prev, [room.id]: !prev[room.id] }))
                            }
                            className={`${pickerButtonCls} h-[56px] overflow-hidden`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[16px] font-semibold text-slate-900">
                                  {pickerValues[room.id] || "Select room"}
                                </div>
                              </div>
                              <span className="shrink-0 text-blue-600">
                                {openPickers[room.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </span>
                            </div>
                          </button>

                          {openPickers[room.id] ? (
                            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-blue-100/60">
                              <div className="border-b border-slate-100 bg-blue-50/60 px-4 py-3">
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                  Select available room
                                </div>
                                <div className="mt-1 text-[14px] font-semibold text-slate-600">
                                  {getAvailableRoomsForType(room.id).length} room(s) ready to assign
                                </div>
                              </div>

                              {getAvailableRoomsForType(room.id).length ? (
                                <div className="max-h-64 overflow-y-auto overscroll-contain p-2">
                                  {getAvailableRoomsForType(room.id).map((item) => (
                                    <button
                                      key={item}
                                      type="button"
                                      onClick={() => {
                                        setPickerValues((prev) => ({ ...prev, [room.id]: item }));
                                        handlePickAvailableRoom(room.id, item);
                                      }}
                                      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-blue-50"
                                    >
                                      <div>
                                        <div className="text-[15px] font-black text-slate-900">{item}</div>
                                        <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                          Ready for booking
                                        </div>
                                      </div>
                                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                                        Available
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="px-4 py-5 text-[14px] font-semibold text-slate-500">
                                  No available room in this type
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <input
                            value={inputValue[room.id] || ""}
                            onChange={(e) =>
                              setInputValue((prev) => ({
                                ...prev,
                                [room.id]: e.target.value,
                              }))
                            }
                            placeholder="Room no."
                            className={`${fieldCls} h-[56px]`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddOption(room.id)}
                          className="inline-flex h-[56px] w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-600 px-5 text-[14px] font-bold tracking-[0.01em] text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl lg:w-auto lg:min-w-[150px]"
                        >
                          <Plus size={18} />
                          Add Room
                        </button>
                      </div>

                      {/* Room checkbox grid — BUG FIX: proper state-based badge */}
                      <div className="mt-6 rounded-[20px] border border-blue-100 bg-white p-4 sm:rounded-[24px] sm:p-5 lg:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-[16px] font-black uppercase tracking-[0.2em] text-slate-900">
                              Room List
                            </div>
                            <div className="mt-1.5 text-[14px] font-semibold text-slate-500 sm:text-[15px]">
                              Overall room inventory for this category with price setup.
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[minmax(0,190px)_160px]">
                            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 backdrop-blur-sm">
                              <div className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-700">
                                Price Setup
                              </div>
                              <div className="mt-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={priceInputs[room.id] ?? room.defaultPrice}
                                  onChange={(e) =>
                                    setPriceInputs((prev) => ({
                                      ...prev,
                                      [room.id]: e.target.value,
                                    }))
                                  }
                                  className={fieldCls}
                                  placeholder="Enter price"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handlePriceSave(room.id)}
                              className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 text-[14px] font-bold text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                            >
                              <Save size={18} />
                              Save Price
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const rooms = roomOptions[room.id] || [];
                          // Deduplicate to prevent React key conflicts (e.g. stale data from before the fix)
                          const uniqueRooms = [...new Set(rooms)];
                          const totalPages = Math.max(1, Math.ceil(uniqueRooms.length / ROOM_LIST_PAGE_SIZE));
                          const currentPage = Math.min(roomListPages[room.id] || 1, totalPages);
                          const startIndex = (currentPage - 1) * ROOM_LIST_PAGE_SIZE;
                          const visibleRooms = uniqueRooms.slice(startIndex, startIndex + ROOM_LIST_PAGE_SIZE);
                          const showingFrom = uniqueRooms.length ? startIndex + 1 : 0;
                          const showingTo = Math.min(startIndex + visibleRooms.length, uniqueRooms.length);

                          return (
                            <>
                              <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                                {visibleRooms.map((item) => {
                                  const roomState = getRoomState(item);
                                  const meta = AVAILABILITY_BADGE[roomState];
                                  const isSelected = selectedRooms[room.id]?.includes(item);
                                  const isLocked = meta.disabled;

                                  return (
                                    <div
                                      key={item}
                                      className={`flex max-w-full items-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-bold transition duration-300 sm:gap-3 sm:px-5 sm:py-3.5 sm:text-[15px]
                                        ${isLocked ? "opacity-70" : ""}
                                        ${isSelected
                                          ? "border-transparent bg-white shadow-[0_0_0_2px_theme(colors.blue.500),0_10px_28px_rgba(37,99,235,0.22)]"
                                          : `bg-white ${meta.pill}`
                                        }
                                      `}
                                    >
                                      <label className="flex flex-1 cursor-pointer items-center gap-2 sm:gap-3 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isSelected || false}
                                          disabled={isLocked}
                                          onChange={() => handleSelect(room.id, item)}
                                          className="h-[22px] w-[22px] shrink-0 accent-blue-600"
                                        />
                                        <span className={`truncate ${isSelected ? "text-blue-700" : "text-slate-900"}`}>{item}</span>
                                        <span
                                          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${meta.classes}`}
                                        >
                                          {meta.label}
                                        </span>
                                      </label>
                                      {/* Delete button — always visible */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleDeleteRoom(room.id, item);
                                        }}
                                        title={`Remove room ${item}`}
                                        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  );
                                })}

                                {!rooms.length && (
                                  <p className="text-[14px] italic text-slate-400">
                                    No rooms added yet — add room number above.
                                  </p>
                                )}
                              </div>

                              {rooms.length > ROOM_LIST_PAGE_SIZE && (
                                <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                                  <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                    Showing {showingFrom}-{showingTo} of {rooms.length} rooms
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRoomListPages((prev) => ({
                                          ...prev,
                                          [room.id]: Math.max(1, currentPage - 1),
                                        }))
                                      }
                                      disabled={currentPage === 1}
                                      className="rounded-full border border-slate-200 px-5 py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-[12px]"
                                    >
                                      Prev
                                    </button>
                                    <span className="rounded-full bg-blue-50 px-4 py-2 text-[12px] font-bold text-blue-700">
                                      Page {currentPage} / {totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRoomListPages((prev) => ({
                                          ...prev,
                                          [room.id]: Math.min(totalPages, currentPage + 1),
                                        }))
                                      }
                                      disabled={currentPage === totalPages}
                                      className="rounded-full border border-slate-200 px-5 py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-[12px]"
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Footer actions */}
        <div className="flex flex-col gap-3 rounded-[22px] border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:justify-end sm:rounded-[26px] sm:p-5 lg:p-6">
          <button
            type="button"
            onClick={() => navigate("/hotel/company")}
            className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-[15px] font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>

          <BookingCancelAction
            bookingId={bookingId}
            bookingCode={bookingCode}
            buttonClassName="sm:min-w-[170px] h-[56px] rounded-2xl"
          />

          <button
            type="button"
            onClick={handleProceed}
            className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-600 px-7 text-[15px] font-bold text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
          >
            Save & Proceed
            <ArrowRight size={20} />
          </button>
        </div>

        {notice.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div
              ref={noticeDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="room-notice-title"
              aria-describedby="room-notice-message"
              tabIndex={-1}
              className="w-full max-w-md rounded-[28px] border border-blue-100 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
                    notice.tone === "error"
                      ? "bg-rose-50 text-rose-600"
                      : notice.tone === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-blue-50 text-blue-600"
                  }`}
                >
                  <BadgeCheck size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="room-notice-title" className="text-[20px] font-black text-slate-900">
                    {notice.title}
                  </h3>
                  <p id="room-notice-message" className="mt-2 text-[15px] leading-6 text-slate-600">
                    {notice.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setNotice((prev) => ({
                      ...prev,
                      open: false,
                    }))
                  }
                  className="inline-flex h-[52px] min-w-[110px] items-center justify-center rounded-2xl bg-gradient-to-r from-blue-900 to-blue-600 px-6 text-[15px] font-bold text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;
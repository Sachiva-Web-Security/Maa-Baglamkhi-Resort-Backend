const BOOKING_ID_KEY = "hotel_active_booking_id";
const BOOKING_CODE_KEY = "hotel_active_booking_code";
const BOOKING_DRAFT_KEY = "hotel_booking_step_draft";
const CLEANING_TASKS_KEY = "hotel_cleaning_tasks";
const COMPLETED_CLEANING_LOGS_KEY = "hotel_completed_cleaning_logs";

export const getStoredBookingId = () => {
  try {
    return sessionStorage.getItem(BOOKING_ID_KEY) || "";
  } catch {
    return "";
  }
};

export const setStoredBookingId = (bookingId) => {
  if (!bookingId) return;
  try {
    sessionStorage.setItem(BOOKING_ID_KEY, String(bookingId));
  } catch {
    // ignore
  }
};

export const getStoredBookingCode = () => {
  try {
    return sessionStorage.getItem(BOOKING_CODE_KEY) || "";
  } catch {
    return "";
  }
};

export const setStoredBookingCode = (bookingCode) => {
  if (!bookingCode) return;
  try {
    sessionStorage.setItem(BOOKING_CODE_KEY, String(bookingCode));
  } catch {
    // ignore
  }
};

export const clearBookingSession = () => {
  try {
    sessionStorage.removeItem(BOOKING_ID_KEY);
    sessionStorage.removeItem(BOOKING_CODE_KEY);
    sessionStorage.removeItem(BOOKING_DRAFT_KEY);
  } catch {
    // ignore
  }
};

export const getBookingDraft = (step) => {
  try {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return step ? parsed[step] || null : parsed;
  } catch {
    return step ? null : {};
  }
};

export const setBookingDraft = (step, value) => {
  try {
    const current = getBookingDraft();
    const next = { ...current, [step]: value };
    sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
};

export const getCleaningTasks = () => {
  try {
    const raw = localStorage.getItem(CLEANING_TASKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const setCleaningTasks = (tasks) => {
  try {
    localStorage.setItem(CLEANING_TASKS_KEY, JSON.stringify(tasks || {}));
  } catch {
    // ignore
  }
};

export const upsertCleaningTask = (roomKey, value) => {
  if (!roomKey) return;
  const current = getCleaningTasks();
  const next = {
    ...current,
    [String(roomKey)]: {
      ...current[String(roomKey)],
      ...value,
    },
  };
  setCleaningTasks(next);
};

export const removeCleaningTask = (roomKey) => {
  if (!roomKey) return;
  const current = getCleaningTasks();
  delete current[String(roomKey)];
  setCleaningTasks(current);
};

export const getCompletedCleaningLogs = () => {
  try {
    const raw = localStorage.getItem(COMPLETED_CLEANING_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const setCompletedCleaningLogs = (logs) => {
  try {
    localStorage.setItem(COMPLETED_CLEANING_LOGS_KEY, JSON.stringify(Array.isArray(logs) ? logs : []));
  } catch {
    // ignore
  }
};

export const addCompletedCleaningLog = (entry) => {
  if (!entry) return;
  const current = getCompletedCleaningLogs();
  const next = [
    {
      ...entry,
      completedAt: entry.completedAt || new Date().toISOString(),
    },
    ...current,
  ].slice(0, 200);
  setCompletedCleaningLogs(next);
};

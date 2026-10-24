import React, { useEffect, useState } from "react";
import {
  FaClock,
  FaFingerprint,
  FaPlus,
  FaSync,
  FaTrash,
  FaTimes,
} from "react-icons/fa";
import API from "../api";

/* Admin panel for ESSL / ZKTeco fingerprint attendance machines.
   Registers devices by IP, verifies their clock, and pulls fingerprint
   punches over TCP (the ZKTeco packet protocol). Punches land in
   attendance_records as "ZK fingerprint" rows with day/night shift
   resolution from each machine's shift split. */

const DEFAULT_FORM = {
  name: "",
  ip: "",
  port: 4380,
  machineIp: "",
  machinePort: "",
  status: "active",
  dayShiftStart: "09:00:00",
  dayShiftEnd: "18:00:00",
  nightShiftStart: "18:00:00",
  nightShiftEnd: "09:00:00",
};

const ZkAttendance = () => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [syncing, setSyncing] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadMachines = async () => {
    try {
      const res = await API.get("/zk/machines");
      setMachines(Array.isArray(res.data?.machines) ? res.data.machines : []);
    } catch (err) {
      setError(err.response?.data?.message || "Machines could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (machine) => {
    setForm({
      name: machine.name,
      ip: machine.ip,
      port: machine.port,
      machineIp: machine.machineIp,
      machinePort: machine.machinePort,
      status: machine.status,
      dayShiftStart: String(machine.dayShiftStart || "09:00:00").slice(0, 5),
      dayShiftEnd: String(machine.dayShiftEnd || "18:00:00").slice(0, 5),
      nightShiftStart: String(machine.nightShiftStart || "18:00:00").slice(0, 5),
      nightShiftEnd: String(machine.nightShiftEnd || "09:00:00").slice(0, 5),
    });
    setEditing(machine.id);
    setShowForm(true);
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const saveMachine = async () => {
    if (!form.name.trim() || !form.ip.trim()) {
      setError("Name and IP are required.");
      return;
    }
    const payload = {
      ...form,
      port: Number(form.port) || 4380,
      machineIp: form.machineIp || form.ip,
      machinePort: Number(form.machinePort) || Number(form.port) || 4380,
      dayShiftStart: form.dayShiftStart,
      dayShiftEnd: form.dayShiftEnd,
      nightShiftStart: form.nightShiftStart,
      nightShiftEnd: form.nightShiftEnd,
    };
    setError("");
    try {
      if (editing) {
        await API.put(`/zk/machines/${editing}`, payload);
        setNotice("Machine updated.");
      } else {
        await API.post("/zk/machines", payload);
        setNotice("Machine registered.");
      }
      resetForm();
      loadMachines();
    } catch (err) {
      setError(err.response?.data?.message || "Machine could not be saved.");
    }
  };

  const removeMachine = async (id) => {
    if (!window.confirm("Remove this machine? Its pull history stays.")) return;
    setError("");
    try {
      await API.delete(`/zk/machines/${id}`);
      setNotice("Machine removed.");
      loadMachines();
    } catch (err) {
      setError(err.response?.data?.message || "Machine could not be removed.");
    }
  };

  const verifyTime = async (machine) => {
    setVerifying(machine.id);
    setVerifyResult(null);
    setError("");
    try {
      const res = await API.post(`/zk/machines/${machine.id}/verify-time`, {});
      const d = res.data;
      setVerifyResult(
        d.deviceTime
          ? `Device clock ${d.deviceTime} — drift ${Math.abs(d.driftSeconds)}s vs server`
          : "Device answered with no readable clock."
      );
    } catch (err) {
      setError(`Time check failed for ${machine.name}: ${err.response?.data?.message || err.message}`);
    } finally {
      setVerifying(null);
    }
  };

  const syncMachine = async (machine) => {
    setSyncing(machine.id);
    setLastSync(null);
    setError("");
    try {
      const res = await API.post(`/zk/machines/${machine.id}/sync`, {});
      setLastSync(res.data);
      setNotice(
        `Synced ${machine.name}: ${res.data.logsPulled} punches, ` +
          `${res.data.recordsCreated} new records, ${res.data.recordsUpdated} updated.`
      );
      loadMachines();
    } catch (err) {
      setError(`Sync failed for ${machine.name}: ${err.response?.data?.message || err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const timeCell = (value) => String(value || "").slice(0, 5);

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto", fontFamily: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <FaFingerprint style={{ color: "#2e7d32" }} />
          Fingerprint Attendance (ESSL / ZKTeco)
        </h2>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 8, border: "1px solid #2e7d32",
            background: showForm ? "#fff" : "#2e7d32", color: showForm ? "#2e7d32" : "#fff",
            cursor: "pointer", fontWeight: 600,
          }}
        >
          {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Register machine</>}
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#fdecea", color: "#c62828", marginBottom: 14 }}>{error}</div>
      )}
      {notice && !error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#e8f5e9", color: "#1b5e20", marginBottom: 14 }}>{notice}</div>
      )}
      {verifyResult && (
        <div style={{ padding: 10, borderRadius: 8, background: "#e3f2fd", color: "#0d47a1", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          <FaClock /> {verifyResult}
        </div>
      )}
      {lastSync && (
        <div style={{ padding: 10, borderRadius: 8, background: "#e3f2fd", color: "#0d47a1", marginBottom: 14 }}>
          <strong>Last sync ({lastSync.machine}):</strong> {lastSync.logsPulled} punches in
          {lastSync.window.from} → {lastSync.window.to}, {lastSync.recordsCreated} created,
          {" "}{lastSync.recordsUpdated} updated, at {lastSync.syncedAt}.
        </div>
      )}

      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 18, marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>{editing ? "Edit machine" : "Register machine"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>Name<input value={form.name} onChange={setField("name")} placeholder="Front desk" style={inputStyle} /></label>
            <label>IP<input value={form.ip} onChange={setField("ip")} placeholder="192.168.1.50" style={inputStyle} /></label>
            <label>Port<input type="number" value={form.port} onChange={setField("port")} style={inputStyle} /></label>
            <label>Status
              <select value={form.status} onChange={setField("status")} style={inputStyle}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <label>Machine IP (optional override)
              <input value={form.machineIp} onChange={setField("machineIp")} placeholder="defaults to IP" style={inputStyle} />
            </label>
            <label>Machine port (optional override)
              <input type="number" value={form.machinePort} onChange={setField("machinePort")} placeholder="defaults to port" style={inputStyle} />
            </label>
            <label>Day shift start<input type="time" value={form.dayShiftStart} onChange={setField("dayShiftStart")} style={inputStyle} /></label>
            <label>Day shift end<input type="time" value={form.dayShiftEnd} onChange={setField("dayShiftEnd")} style={inputStyle} /></label>
            <label>Night shift start<input type="time" value={form.nightShiftStart} onChange={setField("nightShiftStart")} style={inputStyle} /></label>
            <label>Night shift end<input type="time" value={form.nightShiftEnd} onChange={setField("nightShiftEnd")} style={inputStyle} /></label>
          </div>
          <p style={{ fontSize: 12, color: "#666", margin: "10px 0 0" }}>
            The night shift split owns 18:00–23:59 and 00:00–08:59, so a 06:00 punch reports against the previous day.
          </p>
          <button onClick={saveMachine} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 8, background: "#2e7d32", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
            {editing ? "Save changes" : "Register machine"}
          </button>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={thStyle}>Machine</th>
              <th style={thStyle}>Address</th>
              <th style={thStyle}>Shifts (day / night)</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last sync</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={tdStyle}>Loading machines…</td></tr>
            ) : machines.length === 0 ? (
              <tr><td colSpan={6} style={tdStyle}>No machines registered yet.</td></tr>
            ) : (
              machines.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>
                    <strong>{m.name}</strong>
                    <div style={{ fontSize: 12, color: "#777" }}>{String(m.ip || "").includes(":") ? m.ip : `${m.ip}`}</div>
                  </td>
                  <td style={tdStyle}>{m.ip || m.machineIp}:{m.machinePort || m.port}</td>
                  <td style={tdStyle}>
                    {timeCell(m.dayShiftStart)}–{timeCell(m.dayShiftEnd)}{" "}
                    <span style={{ color: "#999" }}>/</span>{" "}
                    {timeCell(m.nightShiftStart)}–{timeCell(m.nightShiftEnd)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: m.status === "active" ? "#e8f5e9" : "#fdecea",
                      color: m.status === "active" ? "#1b5e20" : "#c62828",
                    }}>{m.status}</span>
                  </td>
                  <td style={tdStyle}>{m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : "never"}{m.lastSyncStatus ? ` (${m.lastSyncStatus})` : ""}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <ActionBtn onClick={() => syncMachine(m)} disabled={syncing === m.id} accent>
                        <FaSync /> {syncing === m.id ? "Syncing…" : "Sync"}
                      </ActionBtn>
                      <ActionBtn onClick={() => verifyTime(m)} disabled={verifying === m.id}>
                        <FaClock /> {verifying === m.id ? "Checking…" : "Check time"}
                      </ActionBtn>
                      <ActionBtn onClick={() => startEdit(m)}><FaTimes style={{ display: "none" }} />Edit</ActionBtn>
                      <ActionBtn onClick={() => removeMachine(m.id)} danger><FaTrash />Remove</ActionBtn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle = { padding: "10px 12px", fontWeight: 600, color: "#444" };
const tdStyle = { padding: "10px 12px", verticalAlign: "top" };
const inputStyle = {
  width: "100%", marginTop: 4, padding: "7px 9px",
  border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box",
};

const ActionBtn = ({ children, onClick, disabled, accent, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: "1px solid " + (accent ? "#2e7d32" : danger ? "#c62828" : "#999"),
      background: accent ? "#e8f5e9" : danger ? "#fdecea" : "#f5f5f5",
      color: accent ? "#2e7d32" : danger ? "#c62828" : "#333",
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </button>
);

export default ZkAttendance;

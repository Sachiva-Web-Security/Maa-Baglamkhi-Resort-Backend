import { useState, useEffect, useRef } from "react";
import { FaFileAlt, FaPrint, FaRedo, FaStop, FaSync, FaTimes } from "react-icons/fa";
import PrintService from "../services/printService";

const PRINT_TYPE_LABELS = {
  gst_invoice: "GST Invoice",
  final_invoice: "Final Invoice",
  checkout_bill: "Checkout Bill",
  advance_payment: "Advance Payment",
  advance_receipt: "Advance Receipt",
  restaurant_bill_a4: "Restaurant Bill (A4)",
  room_service_bill_a4: "Room Service Bill (A4)",
  restaurant_pos_bill: "Restaurant POS Bill",
  room_service_bill: "Room Service Bill",
  kot: "Kitchen Order Ticket",
  cash_receipt: "Cash Receipt",
  refund_receipt: "Refund Receipt",
  payment_receipt: "Payment Receipt",
  folio_statement: "Folio Statement",
};

const STATUS_STYLES = {
  success: { bg: "#e8f5e9", color: "#1b5e20", label: "SUCCESS" },
  completed: { bg: "#e8f5e9", color: "#1b5e20", label: "COMPLETED" },
  failed: { bg: "#fdecea", color: "#c62828", label: "FAILED" },
  queued: { bg: "#fff4e5", color: "#b26a00", label: "QUEUED" },
  processing: { bg: "#e3f2fd", color: "#0d47a1", label: "PROCESSING" },
};

const HISTORY_PER_PAGE = 20;

const StatusPill = ({ status }) => {
  const s =
    STATUS_STYLES[String(status || "").toLowerCase()] ||
    { bg: "#f1f5f9", color: "#475569", label: String(status || "UNKNOWN").toUpperCase() };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
};

const SectionCard = ({ title, action, children }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <h3 className="text-[15px] font-bold text-[#1f2a44]">{title}</h3>
      {action}
    </header>
    <div className="p-2 sm:p-0">{children}</div>
  </section>
);

const PageButton = ({ children, onClick, type = "button", primary, disabled }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={
      "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-bold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 " +
      (primary
        ? "bg-[#2563eb] text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)] hover:bg-[#1d4ed8]"
        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
    }
  >
    {children}
  </button>
);

const Modal = ({ title, open, onClose, onSubmit, submitLabel, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1f2a44]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FaTimes />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <PageButton onClick={onClose}>Cancel</PageButton>
          <PageButton primary onClick={onSubmit}>
            {submitLabel}
          </PageButton>
        </div>
      </div>
    </div>
  );
};

const FieldLabel = ({ children }) => (
  <label className="mb-1.5 block text-xs font-bold text-slate-600">{children}</label>
);

const FieldInput = (props) => (
  <input
    {...props}
    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
  />
);

const FieldSelect = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
  >
    {children}
  </select>
);

function PrintManagement() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [queue, setQueue] = useState(null);
  const [printTypes, setPrintTypes] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [reprintModal, setReprintModal] = useState(false);
  const [testPrintModal, setTestPrintModal] = useState(false);
  const [reprintForm, setReprintForm] = useState({ printType: "gst_invoice", invoiceNo: "", kotNo: "" });
  const [testForm, setTestForm] = useState({ printerKey: "A4_PRINTER", message: "Test Print - Maa Baglamukhi Resort" });
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const pushToast = (text, tone = "success") => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadQueueStatus, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [historyRes, queueRes, typesRes] = await Promise.all([
        PrintService.getHistory({ limit: 50 }),
        PrintService.getQueueStatus(),
        PrintService.getPrintTypes(),
      ]);

      setHistory(historyRes.history || []);
      setQueue(queueRes);
      setPrintTypes(typesRes);
      setHistoryPage(1);
    } catch (err) {
      pushToast("Failed to load print data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadQueueStatus = async () => {
    try {
      const res = await PrintService.getQueueStatus();
      setQueue(res);
    } catch {}
  };

  const handleReprint = async () => {
    if (!reprintForm.printType) {
      pushToast("Select a print type", "error");
      return;
    }
    if (!reprintForm.invoiceNo && !reprintForm.kotNo) {
      pushToast("Enter an Invoice No or KOT No", "error");
      return;
    }

    try {
      const result = await PrintService.reprint(
        reprintForm.printType,
        reprintForm.invoiceNo,
        reprintForm.kotNo
      );
      if (result.success) {
        pushToast("Reprint queued successfully");
        setReprintModal(false);
        setReprintForm({ printType: "gst_invoice", invoiceNo: "", kotNo: "" });
        loadAllData();
      } else {
        pushToast(result.error || "Reprint failed", "error");
      }
    } catch (err) {
      pushToast("Reprint failed: " + err.message, "error");
    }
  };

  const handleTestPrint = async () => {
    try {
      const result = await PrintService.testPrint(testForm.printerKey, testForm.message);
      if (result.success) {
        pushToast("Test print sent successfully");
        setTestPrintModal(false);
      } else {
        pushToast(result.error || "Test print failed", "error");
      }
    } catch (err) {
      pushToast("Test print failed: " + err.message, "error");
    }
  };

  const handleCancelJob = async (jobId) => {
    try {
      await PrintService.cancelJob(jobId);
      pushToast("Job cancelled");
      loadQueueStatus();
    } catch (err) {
      pushToast("Failed to cancel job: " + err.message, "error");
    }
  };

  const queueJobs = queue?.recentJobs || [];
  const historyTotalPages = Math.max(1, Math.ceil(history.length / HISTORY_PER_PAGE));
  const pagedHistory = history.slice(
    (historyPage - 1) * HISTORY_PER_PAGE,
    historyPage * HISTORY_PER_PAGE
  );

  const thClass = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500";
  const tdClass = "px-4 py-3 align-middle text-[13px] text-slate-700";

  const refreshAction = (
    <PageButton onClick={loadQueueStatus}>
      <FaSync /> Refresh
    </PageButton>
  );

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 md:p-7 transition-all duration-300">
      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={
                "max-w-sm rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg " +
                (t.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-800")
              }
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="m-0 text-[22px] font-bold leading-tight text-[#1f2a44] sm:text-[26px]">
          <span className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-blue-600 sm:text-[13px]">
            <FaPrint />
            Printing
          </span>
          Print Management
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <PageButton onClick={loadAllData}>
            <FaSync /> Refresh
          </PageButton>
          <PageButton onClick={() => setReprintModal(true)}>
            <FaRedo /> Reprint
          </PageButton>
          <PageButton primary onClick={() => setTestPrintModal(true)}>
            <FaFileAlt /> Test Print
          </PageButton>
        </div>
      </div>

      {/* Stats */}
      {queue && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">Queued</p>
            <p className="mt-1 text-3xl font-bold text-amber-700">{queue.counts?.queued || 0}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-blue-700">Processing</p>
            <p className="mt-1 text-3xl font-bold text-blue-700">{queue.counts?.processing || 0}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-green-700">Completed</p>
            <p className="mt-1 text-3xl font-bold text-green-700">{queue.counts?.completed || 0}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-red-700">Failed</p>
            <p className="mt-1 text-3xl font-bold text-red-700">{queue.counts?.failed || 0}</p>
          </div>
        </div>
      )}

      {/* Print Queue */}
      <div className="mt-4 space-y-4">
        <SectionCard title="Print Queue" action={refreshAction}>
          {queue === null ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading queue…</div>
          ) : queueJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    <th className={thClass}>Job ID</th>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Printer</th>
                    <th className={thClass}>Priority</th>
                    <th className={thClass}>Retries</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queueJobs.map((row) => (
                    <tr key={row.job_id} className="border-t border-slate-100">
                      <td className={tdClass}>
                        <span title={row.job_id} className="block max-w-[160px] truncate font-mono text-xs text-slate-500">
                          {row.job_id}
                        </span>
                      </td>
                      <td className={tdClass}>{PRINT_TYPE_LABELS[row.print_type] || row.print_type}</td>
                      <td className={tdClass}>{row.printer_name || "-"}</td>
                      <td className={tdClass}>
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={
                            row.priority >= 10
                              ? { background: "#fdecea", color: "#c62828" }
                              : row.priority >= 5
                              ? { background: "#fff4e5", color: "#b26a00" }
                              : { background: "#f1f5f9", color: "#475569" }
                          }
                        >
                          P{row.priority}
                        </span>
                      </td>
                      <td className={tdClass}>
                        {row.retry_count}/{row.max_retries}
                      </td>
                      <td className={tdClass}>
                        <StatusPill status={row.status} />
                      </td>
                      <td className={tdClass}>
                        {row.status === "queued" ? (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(row.job_id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 transition hover:bg-red-100"
                          >
                            <FaStop /> Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-400">No jobs in queue</div>
          )}
        </SectionCard>

        {/* Print History */}
        <SectionCard
          title="Print History"
          action={
            <div className="flex items-center gap-2">
              <PageButton onClick={loadAllData}>
                <FaSync /> Refresh
              </PageButton>
            </div>
          }
        >
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading history…</div>
          ) : history.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className={thClass}>Print No</th>
                      <th className={thClass}>Type</th>
                      <th className={thClass}>Printer</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Printed At</th>
                      <th className={thClass}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHistory.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className={tdClass}>
                          <span className="font-mono text-xs">
                            {row.print_no || `#${row.id}`}
                          </span>
                        </td>
                        <td className={tdClass}>{PRINT_TYPE_LABELS[row.print_type] || row.print_type}</td>
                        <td className={tdClass}>{row.printer_name || "-"}</td>
                        <td className={tdClass}>
                          <StatusPill status={row.status} />
                        </td>
                        <td className={tdClass}>
                          {row.printed_at ? new Date(row.printed_at).toLocaleString("en-IN") : "N/A"}
                        </td>
                        <td className={tdClass}>
                          {row.error_message ? (
                            <span title={row.error_message} className="block max-w-[320px] truncate text-red-600">
                              {row.error_message}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-xs font-semibold text-slate-500">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <div className="flex gap-2">
                  <PageButton disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
                    Previous
                  </PageButton>
                  <PageButton
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Next
                  </PageButton>
                </div>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-slate-400">No print history</div>
          )}
        </SectionCard>
      </div>

      {/* Reprint Modal */}
      <Modal
        title="Reprint Document"
        open={reprintModal}
        onClose={() => setReprintModal(false)}
        onSubmit={handleReprint}
        submitLabel="Reprint"
      >
        <div>
          <FieldLabel>Print Type</FieldLabel>
          <FieldSelect
            value={reprintForm.printType}
            onChange={(e) => setReprintForm({ ...reprintForm, printType: e.target.value })}
          >
            {reprintForm.printType && !printTypes?.types?.some((t) => t.printType === reprintForm.printType) && (
              <option value={reprintForm.printType}>{PRINT_TYPE_LABELS[reprintForm.printType] || reprintForm.printType}</option>
            )}
            {printTypes?.types?.map((t) => (
              <option key={t.printType} value={t.printType}>
                {t.label}
              </option>
            ))}
          </FieldSelect>
        </div>
        <div>
          <FieldLabel>Invoice Number</FieldLabel>
          <FieldInput
            placeholder="e.g., HOTINV-20250725-0001"
            value={reprintForm.invoiceNo}
            onChange={(e) => setReprintForm({ ...reprintForm, invoiceNo: e.target.value })}
          />
        </div>
        {["kot", "kot_customer_copy"].includes(reprintForm.printType) && (
          <div>
            <FieldLabel>KOT Number</FieldLabel>
            <FieldInput
              placeholder="e.g., KOT-000152"
              value={reprintForm.kotNo}
              onChange={(e) => setReprintForm({ ...reprintForm, kotNo: e.target.value })}
            />
          </div>
        )}
      </Modal>

      {/* Test Print Modal */}
      <Modal
        title="Test Print"
        open={testPrintModal}
        onClose={() => setTestPrintModal(false)}
        onSubmit={handleTestPrint}
        submitLabel="Send test print"
      >
        <div>
          <FieldLabel>Printer</FieldLabel>
          <FieldSelect
            value={testForm.printerKey}
            onChange={(e) => setTestForm({ ...testForm, printerKey: e.target.value })}
          >
            {testForm.printerKey && !printTypes?.printers?.some((p) => p.printerKey === testForm.printerKey) && (
              <option value={testForm.printerKey}>{testForm.printerKey}</option>
            )}
            {printTypes?.printers?.map((p) => (
              <option key={p.printerKey} value={p.printerKey}>
                {p.name} ({p.type})
              </option>
            ))}
          </FieldSelect>
        </div>
        <div>
          <FieldLabel>Test Message</FieldLabel>
          <FieldInput
            value={testForm.message}
            onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}

export default PrintManagement;

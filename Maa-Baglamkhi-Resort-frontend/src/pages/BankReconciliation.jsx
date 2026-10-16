import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChartLine, FaTable } from "react-icons/fa";

import ReconciliationOverview from "../components/Accounts/ReconciliationOverview";
import API from "../api";

const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const BankReconciliation = () => {
  const navigate = useNavigate();
  const refreshTimerRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const [selectedPaymentMode, setSelectedPaymentMode] = useState("all");
  const [selectedReconciliationSource, setSelectedReconciliationSource] = useState("all");
  const [selectedReconciliationMatch, setSelectedReconciliationMatch] = useState("all");
  const [reconciliationSummary, setReconciliationSummary] = useState({
    totalBankIn: 0,
    totalBankOut: 0,
    matchedAmount: 0,
    unmatchedAmount: 0,
    partialAmount: 0,
    reconciledAmount: 0,
    totalItems: 0,
    unmatchedItems: 0,
    partialItems: 0,
    matchedItems: 0,
  });
  const [reconciliationItems, setReconciliationItems] = useState([]);
  const [bankLedger, setBankLedger] = useState([]);
  const [departmentTotals, setDepartmentTotals] = useState({
    roomIncome: 0,
    restaurantIncome: 0,
    banquetIncome: 0,
    roomExpense: 0,
    restaurantExpense: 0,
    banquetExpense: 0,
  });
  const [extendedSummary, setExtendedSummary] = useState({
    pendingBankReconciliation: 0,
    pettyCashBalance: 0,
    gstPendingPayable: 0,
    vendorOutstanding: 0,
    openPurchaseOrders: 0,
    payrollTotal: 0,
  });

  const isAbortedRequest = (error) =>
    error?.code === "ERR_CANCELED" ||
    error?.message === "canceled" ||
    error?.message === "Request aborted" ||
    error?.name === "CanceledError";

  const paymentModeOptions = ["all", "Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

  const fetchReconciliationData = async () => {
    try {
      const params = {
        paymentMode: selectedPaymentMode,
        sourceType: selectedReconciliationSource,
        matchStatus: selectedReconciliationMatch,
      };

      const [summaryRes, itemsRes] = await Promise.all([
        API.get("/accounts/reconciliation/summary", { params }),
        API.get("/accounts/reconciliation/items", { params }),
      ]);

      setReconciliationSummary(summaryRes.data || {});
      setReconciliationItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
    } catch (error) {
      if (isAbortedRequest(error)) return;
      console.error("Error loading reconciliation data", error);
      setReconciliationSummary({
        totalBankIn: 0,
        totalBankOut: 0,
        matchedAmount: 0,
        unmatchedAmount: 0,
        partialAmount: 0,
        reconciledAmount: 0,
        totalItems: 0,
        unmatchedItems: 0,
        partialItems: 0,
        matchedItems: 0,
      });
      setReconciliationItems([]);
    }
  };

  const fetchBankLedger = async () => {
    try {
      const res = await API.get("/accounts/bank-ledger");
      setBankLedger(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      if (isAbortedRequest(error)) return;
      console.error("Error loading bank ledger", error);
      setBankLedger([]);
    }
  };

  const fetchDepartmentSummary = async () => {
    try {
      const res = await API.get("/accounts/department-summary");
      setDepartmentTotals({
        roomIncome: Number(res.data?.roomIncome) || 0,
        restaurantIncome: Number(res.data?.restaurantIncome) || 0,
        banquetIncome: Number(res.data?.banquetIncome) || 0,
        roomExpense: Number(res.data?.roomExpense) || 0,
        restaurantExpense: Number(res.data?.restaurantExpense) || 0,
        banquetExpense: Number(res.data?.banquetExpense) || 0,
      });
    } catch (error) {
      if (isAbortedRequest(error)) return;
      console.error("Error loading department summary", error);
      setDepartmentTotals({
        roomIncome: 0,
        restaurantIncome: 0,
        banquetIncome: 0,
        roomExpense: 0,
        restaurantExpense: 0,
        banquetExpense: 0,
      });
    }
  };

  const fetchExtendedSummary = async () => {
    try {
      const res = await API.get("/accounts/extended-summary");
      setExtendedSummary({
        pendingBankReconciliation: Number(res.data?.pendingBankReconciliation) || 0,
        pettyCashBalance: Number(res.data?.pettyCashBalance) || 0,
        gstPendingPayable: Number(res.data?.gstPendingPayable) || 0,
        vendorOutstanding: Number(res.data?.vendorOutstanding) || 0,
        openPurchaseOrders: Number(res.data?.openPurchaseOrders) || 0,
        payrollTotal: Number(res.data?.payrollTotal) || 0,
      });
    } catch (error) {
      if (isAbortedRequest(error)) return;
      console.error("Error loading extended summary", error);
      setExtendedSummary({
        pendingBankReconciliation: 0,
        pettyCashBalance: 0,
        gstPendingPayable: 0,
        vendorOutstanding: 0,
        openPurchaseOrders: 0,
        payrollTotal: 0,
      });
    }
  };

  const refreshData = async () => {
    if (refreshInFlightRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;

    try {
      do {
        pendingRefreshRef.current = false;
        await Promise.all([
          fetchReconciliationData(),
          fetchBankLedger(),
          fetchDepartmentSummary(),
          fetchExtendedSummary(),
        ]);
      } while (pendingRefreshRef.current);
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    let active = true;

    const runRefresh = async () => {
      if (!active) return;
      await refreshData();
    };

    runRefresh();

    const handleAccountsUpdated = () => {
      runRefresh();
    };

    refreshTimerRef.current = window.setInterval(() => {
      runRefresh();
    }, 30000);

    window.addEventListener("accountsUpdated", handleAccountsUpdated);
    window.addEventListener("focus", handleAccountsUpdated);

    return () => {
      active = false;
      if (refreshTimerRef.current) {
        window.clearInterval(refreshTimerRef.current);
      }
      window.removeEventListener("accountsUpdated", handleAccountsUpdated);
      window.removeEventListener("focus", handleAccountsUpdated);
    };
  }, [selectedPaymentMode, selectedReconciliationSource, selectedReconciliationMatch]);

  const handleLinkBankLedger = async (payload) => {
    try {
      await API.post("/accounts/reconciliation/match", payload);
      await refreshData();
      window.dispatchEvent(new Event("accountsUpdated"));
      return true;
    } catch (error) {
      console.error("Error linking bank ledger", error);
      window.alert("Bank ledger link failed.");
      return false;
    }
  };

  const handleUnlinkBankLedger = async (payload) => {
    try {
      await API.post("/accounts/reconciliation/unmatch", payload);
      await refreshData();
      window.dispatchEvent(new Event("accountsUpdated"));
      return true;
    } catch (error) {
      console.error("Error unlinking bank ledger", error);
      window.alert("Bank ledger unlink failed.");
      return false;
    }
  };

  const openReconciliationData = () => {
    navigate("/accounts/reconciliation-data");
  };

  const bankCards = [
    { label: "Bank In", value: formatINR(reconciliationSummary.totalBankIn), tone: "text-cyan-700" },
    { label: "Bank Out", value: formatINR(reconciliationSummary.totalBankOut), tone: "text-rose-700" },
    {
      label: "Unmatched Amount",
      value: formatINR(reconciliationSummary.unmatchedAmount),
      tone: "text-amber-700",
    },
    { label: "Ledger Rows", value: String(bankLedger.length || 0), tone: "text-emerald-700" },
  ];
  const departmentSummaryCards = [
    {
      label: "Total Room Income",
      value: formatINR(departmentTotals.roomIncome),
      tone: "text-emerald-700",
    },
    {
      label: "Total Restaurant Income",
      value: formatINR(departmentTotals.restaurantIncome),
      tone: "text-sky-700",
    },
    {
      label: "Total Banquet Income",
      value: formatINR(departmentTotals.banquetIncome),
      tone: "text-violet-700",
    },
    {
      label: "Room Expense",
      value: formatINR(departmentTotals.roomExpense),
      tone: "text-rose-700",
    },
    {
      label: "Restaurant Expense",
      value: formatINR(departmentTotals.restaurantExpense),
      tone: "text-amber-700",
    },
    {
      label: "Banquet Expense",
      value: formatINR(departmentTotals.banquetExpense),
      tone: "text-fuchsia-700",
    },
  ];
  const extendedSummaryCards = [
    {
      label: "Pending Reconciliation",
      value: String(extendedSummary.pendingBankReconciliation),
      tone: "text-cyan-700",
      helper: "Click to open bank entries that still need reconciliation.",
    },
    {
      label: "Petty Cash Balance",
      value: formatINR(extendedSummary.pettyCashBalance),
      tone: "text-emerald-700",
    },
    {
      label: "GST Pending",
      value: formatINR(extendedSummary.gstPendingPayable),
      tone: "text-amber-700",
    },
    {
      label: "Vendor Outstanding",
      value: formatINR(extendedSummary.vendorOutstanding),
      tone: "text-rose-700",
    },
    {
      label: "Open POs",
      value: String(extendedSummary.openPurchaseOrders),
      tone: "text-indigo-700",
    },
    {
      label: "Payroll Total",
      value: formatINR(extendedSummary.payrollTotal),
      tone: "text-fuchsia-700",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#f5fbff_0%,#f3f8f4_28%,#fff8f1_58%,#f8fafc_100%)] p-3 sm:p-4 md:p-6 xl:p-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-8%] top-[-6%] h-56 w-56 rounded-full bg-cyan-200/45 blur-3xl sm:h-72 sm:w-72 md:h-96 md:w-96" />
        <div className="absolute right-[-10%] top-[8%] h-56 w-56 rounded-full bg-amber-200/45 blur-3xl sm:h-72 sm:w-72 md:h-[28rem] md:w-[28rem]" />
      </div>

      <div className="space-y-5 sm:space-y-6 xl:space-y-7">
        {/* HERO SECTION */}
        <section className="overflow-hidden rounded-[22px] border border-slate-900/10 bg-[linear-gradient(120deg,#172554_0%,#1e40af_52%,#0ea5e9_100%)] px-4 py-5 text-white shadow-[0_22px_55px_rgba(15,23,42,0.12)] sm:px-5 sm:py-6 md:rounded-[28px] md:px-7 md:py-8 xl:px-7 xl:py-8">
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.95fr)] lg:items-center">
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200 sm:text-sm sm:tracking-[0.26em]">
                Finance Center
              </p>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl md:text-4xl xl:text-5xl">
                Bank reconciliation full workspace
              </h1>
              <p className="max-w-3xl text-[15px] leading-6 text-slate-100/85 sm:text-base sm:leading-7 md:text-lg md:leading-8 xl:text-xl">
                Manage bank ledger entries, review unmatched billing rows, and complete full
                reconciliation from one dedicated page.
              </p>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/accounts")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[0_16px_35px_rgba(255,255,255,0.15)] sm:w-auto sm:justify-start sm:py-3 sm:text-base"
                >
                  <FaArrowLeft className="text-blue-700" />
                  Back To Accounts
                </button>
                <button
                  type="button"
                  onClick={refreshData}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-200/40 bg-cyan-400/15 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md transition hover:border-cyan-200 hover:bg-cyan-400/20 sm:w-auto sm:justify-start sm:py-3 sm:text-base"
                >
                  <FaChartLine className="text-cyan-200" />
                  Refresh Reconciliation
                </button>
                <button
                  type="button"
                  onClick={openReconciliationData}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md transition hover:border-cyan-200 hover:text-cyan-100 sm:w-auto sm:justify-start sm:py-3 sm:text-base"
                >
                  <FaTable className="text-cyan-200" />
                  Reconciliation Data
                </button>
                <label className="w-full rounded-[18px] border border-white/15 bg-white/10 px-4 py-2.5 text-left backdrop-blur-md sm:min-w-[220px] sm:w-auto sm:rounded-[20px] sm:py-3">
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80 sm:text-sm sm:tracking-[0.2em]">
                    Payment Filter
                  </span>
                  <select
                    value={selectedPaymentMode}
                    onChange={(event) => setSelectedPaymentMode(event.target.value)}
                    className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none sm:text-base"
                  >
                    {paymentModeOptions.map((mode) => (
                      <option key={mode} value={mode} className="text-slate-900">
                        {mode === "all" ? "All Payment Modes" : mode}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-2">
              {bankCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-[18px] border border-white/12 bg-white/10 px-4 py-3.5 backdrop-blur-md sm:rounded-[22px] sm:py-4"
                >
                  <span className="text-[13px] text-slate-100/75 sm:text-sm">{card.label}</span>
                  <div className={`mt-2 text-2xl font-bold leading-none sm:mt-3 sm:text-3xl ${card.tone}`}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ReconciliationOverview
          summary={reconciliationSummary}
          items={reconciliationItems}
          bankLedger={bankLedger}
          sourceFilter={selectedReconciliationSource}
          onSourceFilterChange={setSelectedReconciliationSource}
          matchFilter={selectedReconciliationMatch}
          onMatchFilterChange={setSelectedReconciliationMatch}
          onLink={handleLinkBankLedger}
          onUnlink={handleUnlinkBankLedger}
        />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {departmentSummaryCards.map((item) => (
            <div
              key={item.label}
              className="rounded-[18px] border border-white/60 bg-white/82 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:rounded-[24px] sm:p-5"
            >
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-700 sm:text-[16px] sm:tracking-[0.18em]">
                {item.label}
              </div>
              <div className={`mt-2 text-2xl font-black sm:mt-3 sm:text-[2.35rem] ${item.tone}`}>
                {item.value}
              </div>
              <div className="mt-2 text-[13px] font-semibold text-slate-700 sm:text-[16px]">
                Live backend summary from invoices, restaurant bills, and department-tagged expenses.
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {extendedSummaryCards.map((item) => (
            <div
              key={item.label}
              className="rounded-[18px] border border-white/60 bg-white/82 p-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:rounded-[24px] sm:p-5"
            >
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-700 sm:text-[16px] sm:tracking-[0.18em]">
                {item.label}
              </div>
              <div className={`mt-2 text-2xl font-black sm:mt-3 sm:text-[2.35rem] ${item.tone}`}>
                {item.value}
              </div>
              {item.helper ? (
                <div className="mt-2 text-[13px] font-semibold text-slate-700 sm:text-[16px]">
                  {item.helper}
                </div>
              ) : null}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default BankReconciliation;
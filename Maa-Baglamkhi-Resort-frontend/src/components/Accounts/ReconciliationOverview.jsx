import React from "react";
import { useEffect, useMemo, useState } from "react";

const RECONCILIATION_PAGE_SIZE = 10;

const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const toKey = (item) => `${item.sourceType}:${item.sourceId}`;

const buildBankOptionLabel = (entry) => {
  const amount = Number(entry.amount || entry.credit || entry.debit || 0);
  const reference = entry.reference_no ? ` | ${entry.reference_no}` : "";
  return `${entry.bank_name || "Bank"}${reference} | ${formatINR(amount)}`;
};

const ReconciliationOverview = ({
  summary,
  items,
  bankLedger,
  sourceFilter,
  onSourceFilterChange,
  matchFilter,
  onMatchFilterChange,
  onLink,
  onUnlink,
}) => {
  const [selectedLinks, setSelectedLinks] = useState({});
  const [busyKey, setBusyKey] = useState("");
  const [page, setPage] = useState(1);

  const unlinkedLedger = useMemo(
    () =>
      (bankLedger || []).filter(
        (entry) => !entry.source_type && !entry.source_id && !entry.sourceType && !entry.sourceId,
      ),
    [bankLedger],
  );

  const getCandidates = (item) =>
    unlinkedLedger.filter((entry) => {
      const entryDirection = String(entry.direction || (Number(entry.debit || 0) > 0 ? "out" : "in"))
        .trim()
        .toLowerCase();
      const itemDirection = String(item.direction || "in").trim().toLowerCase();
      if (entryDirection !== itemDirection) return false;

      const entryMode = String(entry.payment_mode || entry.paymentMode || "manual")
        .trim()
        .toLowerCase();
      const itemMode = String(item.paymentMode || "unknown")
        .trim()
        .toLowerCase();
      return entryMode === "manual" || entryMode === itemMode;
    });

  const totalPages = Math.max(1, Math.ceil((items || []).length / RECONCILIATION_PAGE_SIZE));
  const paginatedItems = (items || []).slice(
    (page - 1) * RECONCILIATION_PAGE_SIZE,
    page * RECONCILIATION_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [sourceFilter, matchFilter, items]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleLink = async (item) => {
    const key = toKey(item);
    const bankLedgerId = selectedLinks[key];
    if (!bankLedgerId) return;

    setBusyKey(key);
    try {
      await onLink({
        bankLedgerId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        matchedAmount: item.sourceAmount,
      });
      setSelectedLinks((prev) => ({ ...prev, [key]: "" }));
    } finally {
      setBusyKey("");
    }
  };

  const handleUnlink = async (item) => {
    if (!item.linkedBankLedgerId) return;
    setBusyKey(toKey(item));
    try {
      await onUnlink({ bankLedgerId: item.linkedBankLedgerId });
    } finally {
      setBusyKey("");
    }
  };

  const renderActionControl = (item, { fullWidth = false } = {}) => {
    const key = toKey(item);
    const candidates = getCandidates(item);
    const busy = busyKey === key;
    const widthClass = fullWidth ? "w-full" : "";

    if (item.linkedBankLedgerId) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => handleUnlink(item)}
          className={`${widthClass} rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[14px] font-semibold text-rose-700 disabled:opacity-60 sm:text-[15px]`}
        >
          Unlink
        </button>
      );
    }

    if (candidates.length) {
      return (
        <div className={`flex ${fullWidth ? "w-full" : "min-w-[240px]"} flex-col gap-2`}>
          <select
            value={selectedLinks[key] || ""}
            onChange={(event) =>
              setSelectedLinks((prev) => ({ ...prev, [key]: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] font-semibold text-slate-950 outline-none sm:text-[15px]"
          >
            <option value="">Select bank row</option>
            {candidates.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {buildBankOptionLabel(entry)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selectedLinks[key]}
            onClick={() => handleLink(item)}
            className={`${widthClass} rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[14px] font-semibold text-cyan-700 disabled:opacity-60 sm:text-[15px]`}
          >
            Link
          </button>
        </div>
      );
    }

    return <span className="text-[14px] font-semibold text-slate-700 sm:text-[15px]">No free bank row</span>;
  };

  return (
    <section className="rounded-[20px] border border-white/60 bg-white/82 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:rounded-[26px] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-cyan-800 sm:text-[15px] sm:tracking-[0.16em] xl:text-[18px] xl:tracking-[0.18em]">
            Linked Reconciliation Flow
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl md:text-3xl xl:text-[2.6rem]">
            Billing to bank reconciliation view
          </h2>
          {/* <p className="mt-3 max-w-3xl text-[15px] font-semibold leading-6 text-slate-800 sm:text-base sm:leading-7 xl:text-[20px] xl:leading-8">
            Match paid hotel invoices, restaurant bills, banquet invoices, and vendor payouts with
            bank ledger rows so the accounts team can verify what is billed, what reached the bank,
            and what still needs action.
          </p> */}
        </div>

        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Bank In", value: formatINR(summary.totalBankIn), tone: "text-cyan-700" },
            { label: "Bank Out", value: formatINR(summary.totalBankOut), tone: "text-rose-700" },
            { label: "Unmatched Amount", value: formatINR(summary.unmatchedAmount), tone: "text-amber-700" },
            { label: "Reconciled Amount", value: formatINR(summary.reconciledAmount), tone: "text-emerald-700" },
          ].map((card) => (
            <div
              key={card.label}
              className="min-w-0 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3.5 sm:min-w-[180px] sm:rounded-[20px] sm:px-5 sm:py-4"
            >
              <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-700 sm:text-[14px] sm:tracking-[0.14em] xl:text-[16px] xl:tracking-[0.16em]">
                {card.label}
              </div>
              <div className={`mt-2 text-xl font-black sm:mt-3 sm:text-2xl xl:text-[2.2rem] ${card.tone}`}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <label className="block w-full">
          <span className="mb-2 block text-[13px] font-semibold uppercase tracking-[0.1em] text-slate-700 sm:text-[14px] xl:text-[16px] xl:tracking-[0.14em]">
            Source Filter
          </span>
          <select
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-950 outline-none sm:py-3 sm:text-[16px] xl:text-[18px]"
          >
            <option value="all">All Sources</option>
            <option value="invoice">Hotel Invoices</option>
            <option value="restaurant_bill">Restaurant Bills</option>
            <option value="banquet">Banquet Invoices</option>
            <option value="vendor_payment">Vendor Payments</option>
          </select>
        </label>

        <label className="block w-full">
          <span className="mb-2 block text-[13px] font-semibold uppercase tracking-[0.1em] text-slate-700 sm:text-[14px] xl:text-[16px] xl:tracking-[0.14em]">
            Match Filter
          </span>
          <select
            value={matchFilter}
            onChange={(event) => onMatchFilterChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-950 outline-none sm:py-3 sm:text-[16px] xl:text-[18px]"
          >
            <option value="all">All Match States</option>
            <option value="unmatched">Unmatched</option>
            <option value="partial">Partial</option>
            <option value="matched">Matched</option>
            <option value="reconciled">Reconciled</option>
          </select>
        </label>

        <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-[14px] font-semibold text-slate-800 sm:rounded-[18px] sm:px-5 sm:py-4 sm:text-[16px] xl:text-[18px]">
          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-700 sm:text-[14px] xl:text-[16px] xl:tracking-[0.16em]">
            Flow Hint
          </div>
          <div className="mt-2 leading-6 sm:leading-7">
            Paid billing rows should be linked with a bank ledger entry. Cash rows can remain
            outside bank reconciliation.
          </div>
        </div>
      </div>

      {/* DESKTOP / TABLET TABLE VIEW */}
      <div className="mt-5 hidden overflow-x-auto rounded-[18px] border border-slate-200 md:block">
        <table className="min-w-full text-left text-[16px]">
          <thead className="bg-slate-50 text-[16px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            <tr>
              <th className="px-3 py-4">Source</th>
              <th className="px-3 py-4">Reference</th>
              <th className="px-3 py-4">Party</th>
              <th className="px-3 py-4">Label</th>
              <th className="px-3 py-4">Payment Mode</th>
              <th className="px-3 py-4">Billed</th>
              <th className="px-3 py-4">Bank</th>
              <th className="px-3 py-4">Difference</th>
              <th className="px-3 py-4">Match</th>
              <th className="px-3 py-4">Reconciliation</th>
              <th className="px-3 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => {
              const key = toKey(item);

              return (
                <tr key={key} className="border-t border-slate-200">
                  <td className="px-3 py-4 text-[16px] font-semibold text-slate-800">{item.sourceType}</td>
                  <td className="px-3 py-4 text-[18px] font-semibold text-slate-950">{item.sourceReference}</td>
                  <td className="px-3 py-4 text-[16px] font-semibold text-slate-800">{item.partyName || "-"}</td>
                  <td className="px-3 py-4 text-[16px] font-semibold text-slate-800">{item.sourceLabel || "-"}</td>
                  <td className="px-3 py-4 text-[16px] font-semibold text-slate-800">{item.paymentMode || "-"}</td>
                  <td className="px-3 py-4 text-[18px] font-semibold text-slate-950">
                    {formatINR(item.sourceAmount)}
                  </td>
                  <td className="px-3 py-4 text-[16px] font-semibold text-slate-800">{formatINR(item.bankAmount)}</td>
                  <td className="px-3 py-4 text-[16px] font-semibold text-slate-800">{formatINR(item.difference)}</td>
                  <td className="px-3 py-4">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[15px] font-semibold text-slate-800">
                      {item.matchStatus}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[15px] font-semibold text-slate-800">
                      {item.reconciliationStatus}
                    </span>
                  </td>
                  <td className="px-3 py-4">{renderActionControl(item)}</td>
                </tr>
              );
            })}
            {!items?.length ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-[18px] font-semibold text-slate-700">
                  No reconciliation items for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* MOBILE STACKED CARD VIEW */}
      <div className="mt-5 space-y-3 md:hidden">
        {paginatedItems.map((item) => {
          const key = toKey(item);

          return (
            <div
              key={key}
              className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
                    {item.sourceType}
                  </div>
                  <div className="mt-1 text-[15px] font-black text-slate-950">
                    {item.sourceReference}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-800">
                    {item.matchStatus}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-800">
                    {item.reconciliationStatus}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-slate-100 pt-3">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Party
                  </div>
                  <div className="text-[14px] font-semibold text-slate-800">
                    {item.partyName || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Payment Mode
                  </div>
                  <div className="text-[14px] font-semibold text-slate-800">
                    {item.paymentMode || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Label
                  </div>
                  <div className="text-[14px] font-semibold text-slate-800">
                    {item.sourceLabel || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Difference
                  </div>
                  <div className="text-[14px] font-semibold text-slate-800">
                    {formatINR(item.difference)}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Billed
                  </div>
                  <div className="text-[15px] font-black text-slate-950">
                    {formatINR(item.sourceAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Bank
                  </div>
                  <div className="text-[15px] font-black text-slate-950">
                    {formatINR(item.bankAmount)}
                  </div>
                </div>
              </div>

              <div className="mt-3.5 border-t border-slate-100 pt-3.5">
                {renderActionControl(item, { fullWidth: true })}
              </div>
            </div>
          );
        })}

        {!items?.length ? (
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-8 text-center text-[15px] font-semibold text-slate-700">
            No reconciliation items for the selected filters.
          </div>
        ) : null}
      </div>

      {(items || []).length > RECONCILIATION_PAGE_SIZE ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center text-sm text-slate-500 sm:text-left sm:text-base">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {(page - 1) * RECONCILIATION_PAGE_SIZE + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-900">
              {Math.min(page * RECONCILIATION_PAGE_SIZE, (items || []).length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">{(items || []).length}</span>{" "}
            reconciliation rows
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const isActive = pageNumber === page;

              return (
                <button
                  key={`reconciliation-page-${pageNumber}`}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-10 min-w-[40px] rounded-full border px-3 text-sm font-bold transition ${
                    isActive
                      ? "border-cyan-600 bg-cyan-600 text-white shadow-[0_10px_24px_rgba(8,145,178,0.18)]"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ReconciliationOverview;
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Payment from "./Payment";

const PayNowPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const invoice = location.state || null;
  const backRoute = String(invoice?.entityType || "").toLowerCase() === "room" ? "/restaurant/room-items" : "/restaurant";

  return (
    <div className="space-y-6">
      {/* <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_50%,#0f766e_100%)] px-6 py-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200">Direct Payment Page</p>
            <h1 className="mt-2 text-3xl font-black">Complete bill without popup overlap</h1>
            <p className="mt-2 text-sm text-white/80">
              Yahan full {String(invoice?.entityType || "table").toLowerCase()} bill, customer info, discount aur payment flow clean full-page layout me milega.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(backRoute)}
            className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg"
          >
            {String(invoice?.entityType || "").toLowerCase() === "room" ? "Back To Rooms" : "Back To Tables"}
          </button>
        </div>
      </section> */}

      <Payment
        invoice={invoice}
        onClose={() => navigate(backRoute)}
        showCardList={false}
      />
    </div>
  );
};

export default PayNowPage;

import { FaMapMarkedAlt, FaSnowflake, FaUsers } from "react-icons/fa";

import { getBackendBaseURL } from "../../api";

const BanquetHallCard = ({ hall, selected, onSelect }) => {
  const rawImage = String(hall.image || "").trim();
  const imgSrc = rawImage
    ? rawImage.startsWith("http://") ||
      rawImage.startsWith("https://") ||
      rawImage.startsWith("data:") ||
      rawImage.startsWith("/")
      ? rawImage
      : `${getBackendBaseURL()}/uploads/${rawImage}`
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-full flex-col overflow-hidden rounded-[24px] border text-left transition-all ${
        selected
          ? "border-cyan-400 bg-[linear-gradient(145deg,#0b2748_0%,#103b4d_55%,#18465a_100%)] shadow-[0_18px_45px_rgba(14,165,233,0.18)]"
          : "border-slate-200/80 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)] hover:-translate-y-1 hover:border-cyan-200"
      }`}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={hall.name} className="h-32 w-full object-cover sm:h-40" />
      ) : (
        <div
          className={`flex h-32 items-center justify-center sm:h-40 ${
            selected
              ? "bg-[linear-gradient(135deg,#164e63_0%,#0f172a_100%)]"
              : "bg-[linear-gradient(135deg,#dff7ff_0%,#eef6ff_50%,#fff4df_100%)]"
          }`}
        >
          <span
            className={`rounded-full p-5 text-3xl ${
              selected ? "bg-white/10 text-white" : "bg-white/80 text-cyan-700"
            }`}
          >
            <FaMapMarkedAlt />
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <div
            className={`line-clamp-2 break-words text-lg font-black leading-tight ${
              selected ? "text-white" : "text-slate-900"
            }`}
          >
            {hall.name}
          </div>
          <div
            className={`mt-1 line-clamp-2 text-sm leading-6 ${
              selected ? "text-slate-200" : "text-slate-500"
            }`}
          >
            Elegant venue setup for weddings, social events and premium functions.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div
            className={`rounded-2xl border px-3 py-3 ${
              selected
                ? "border-white/10 bg-white/8 text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
              <FaUsers />
              Capacity
            </div>
            <div className="mt-2 break-words text-lg font-black">{hall.capacity}</div>
          </div>

          <div
            className={`rounded-2xl border px-3 py-3 ${
              selected
                ? "border-white/10 bg-white/8 text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.14em]">
              Rate / hour
            </div>
            <div className="mt-2 break-words text-base font-black sm:text-lg">Rs. {hall.ratePerHour}</div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              selected
                ? "bg-white/10 text-white"
                : "bg-cyan-50 text-cyan-700"
            }`}
          >
            <FaSnowflake />
            {hall.is_ac ? "AC Hall" : "Non-AC Hall"}
          </span>
          <span
            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
              hall.status === "Available"
                ? selected
                  ? "bg-emerald-400/15 text-emerald-100"
                  : "bg-emerald-50 text-emerald-700"
                : selected
                ? "bg-rose-400/15 text-rose-100"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {hall.status}
          </span>
        </div>
      </div>
    </button>
  );
};

export default BanquetHallCard;

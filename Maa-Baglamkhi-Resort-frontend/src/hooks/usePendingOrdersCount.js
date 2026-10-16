import { useEffect, useState } from "react";

import { restaurantService } from "../services/restaurantService";

const CLOSED_ORDER_STATUSES = new Set([
  "cancelled",
  "saved",
  "served",
  "complete",
  "completed",
  "ready",
]);

export function usePendingOrdersCount() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let latestRequestId = 0;

    const loadPendingOrdersCount = async () => {
      const requestId = latestRequestId + 1;
      latestRequestId = requestId;

      try {
        const orders = await restaurantService.getKitchenOrders();
        if (cancelled || requestId !== latestRequestId) return;

        const nextCount = (Array.isArray(orders) ? orders : []).filter((order) => {
          const status = String(order.status || "").toLowerCase();
          return !CLOSED_ORDER_STATUSES.has(status);
        }).length;

        setPendingCount(nextCount);
      } catch (error) {
        if (cancelled || requestId !== latestRequestId) return;
        console.error("Failed to load pending orders count:", error);
        setPendingCount(0);
      }
    };

    loadPendingOrdersCount();
    window.addEventListener("kitchenUpdated", loadPendingOrdersCount);

    return () => {
      cancelled = true;
      window.removeEventListener("kitchenUpdated", loadPendingOrdersCount);
    };
  }, []);

  return pendingCount;
}

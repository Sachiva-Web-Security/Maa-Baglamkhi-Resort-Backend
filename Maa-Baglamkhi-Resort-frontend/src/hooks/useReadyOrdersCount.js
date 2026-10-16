import { useState, useEffect, useRef } from "react";
import API from "../api";
import { restaurantService } from "../services/restaurantService";

const countByStatus = (orders, needle) =>
  (Array.isArray(orders) ? orders : []).filter((item) =>
    String(item.status || "").toLowerCase().includes(needle),
  ).length;

const useReadyOrdersCount = (enabled = true) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const refresh = useRef(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const data = await restaurantService.getKitchenOrders();
      if (!active.current) return;
      setCount(countByStatus(data, "ready"));
    } catch {
      // keep last count on transient errors
    } finally {
      if (active.current) setLoading(false);
    }
  });

  useEffect(() => {
    refresh.current();
    const id = setInterval(refresh.current, 4000);
    return () => clearInterval(id);
  }, [enabled]);

  return { count, loading, refresh: refresh.current };
};

export default useReadyOrdersCount;

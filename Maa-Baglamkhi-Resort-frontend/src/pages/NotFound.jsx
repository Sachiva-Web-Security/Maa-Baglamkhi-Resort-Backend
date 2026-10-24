import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaExclamationCircle } from "react-icons/fa";

export default function NotFound() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === "/404") {
      history.replaceState(null, "", "/dashboard");
    }
  }, [location.pathname]);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 92px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
      }}
    >
      <FaExclamationCircle style={{ fontSize: 56, color: "#94a3b8", marginBottom: 16 }} />
      <h1 style={{ fontSize: 40, color: "#334155", marginBottom: 8 }}>404</h1>
      <p style={{ fontSize: 15, color: "#64748b" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        style={{
          marginTop: 20,
          padding: "10px 24px",
          borderRadius: 10,
          background: "#2563eb",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Back to dashboard
      </Link>
    </div>
  );
}

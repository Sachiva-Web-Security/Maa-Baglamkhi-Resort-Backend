import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import API from "../api";
import { getRoleHome, hasRole, normalizeRole } from "../utils/roleHome";

function isValidSession(data) {
  return Boolean(
    data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data.id &&
      data.role
  );
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const res = await API.get("/auth/me", { skipRetry: true, skipAuthRedirect: true });
        if (!cancelled) {
          setSession(isValidSession(res.data) ? res.data : null);
        }
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Verifying session...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeRole(session.role);

  if (!hasRole(role, allowedRoles)) {
    return <Navigate to={getRoleHome(role)} replace />;
  }

  return children;
};

export default ProtectedRoute;

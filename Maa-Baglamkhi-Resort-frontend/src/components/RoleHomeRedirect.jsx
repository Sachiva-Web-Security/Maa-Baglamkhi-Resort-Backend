import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import API from "../api";
import { getRoleHome } from "../utils/roleHome";

function isValidSession(data) {
  return Boolean(
    data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data.id &&
      data.role
  );
}

const RoleHomeRedirect = () => {
  const [redirectTo, setRedirectTo] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await API.get("/auth/me", { skipRetry: true, skipAuthRedirect: true });
        if (!cancelled) {
          setRedirectTo(isValidSession(res.data) ? getRoleHome(res.data.role) : "/login");
        }
      } catch {
        if (!cancelled) setRedirectTo("/login");
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  if (redirectTo === null) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return <Navigate to={redirectTo} replace />;
};

export default RoleHomeRedirect;

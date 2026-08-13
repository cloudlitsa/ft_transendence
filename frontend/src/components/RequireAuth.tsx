import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.tsx";
import type { ReactNode } from "react";

export default function RequireAuth ({ children } : {children : ReactNode }) {
    const { user , loading } = useAuth();
    if (loading) return <p>Loading ...</p>; //still checking - don't decide yet
    if (!user) return <Navigate to="/login" replace />; //not logged in  - redirect
    return <>{children}</>; // logged in - show the page
}

// src/components/AdminRoute.tsx

import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute
 * Protege qualquer rota exclusiva para administradores.
 * Se o usuário não tiver role === 'admin', redireciona para /dashboard.
 *
 * Uso no App.tsx:
 *   <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { user } = useContext(AuthContext);

  if (!user || user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
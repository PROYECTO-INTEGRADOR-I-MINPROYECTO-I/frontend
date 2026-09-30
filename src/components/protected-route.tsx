// PIM1-45: la app solo tiene una ruta privada real (/, que adentro alterna
// Hoy/Eventos por query param — el ticket menciona /hoy, /crear, /evento/:id,
// /progreso como rutas propias, pero esas nunca se separaron de "/").
// Mientras se resuelve el GET /auth/me/ inicial no se sabe todavía si hay
// sesión, así que no se renderiza ni el contenido privado ni el redirect:
// eso es justo lo que causaba el "flash" de la página antes de este ticket.

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f5f2]">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

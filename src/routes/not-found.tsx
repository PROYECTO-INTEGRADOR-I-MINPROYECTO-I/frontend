import { Link, useLocation } from "react-router-dom";
import { AuthBrandMark } from "../components/auth-brand-mark";
import { Button } from "../components/button";
import { useAuth } from "../lib/auth";

export function NotFoundPage() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f5f2]">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  const primary = user ? { to: "/", label: "Ir a Hoy" } : { to: "/login", label: "Iniciar sesión" };
  const secondary = user
    ? { to: "/?vista=eventos", label: "Ver mis eventos" }
    : { to: "/register", label: "Crear cuenta" };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f5f2] px-0">
      <AuthBrandMark />
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Página no encontrada
          </h1>
          <p className="text-sm text-slate-500">
            La dirección que abriste no existe o cambió.
          </p>
          <code className="block break-all rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">
            {pathname}
          </code>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link to={primary.to}>{primary.label}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={secondary.to}>{secondary.label}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

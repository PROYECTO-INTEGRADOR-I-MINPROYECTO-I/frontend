// PIM1-42: formulario de login conectado a POST /auth/login/ (vía
// useAuth().login, ver src/lib/auth.tsx). Separado de la página (login.tsx)
// porque este es el pedazo que se reutilizaría si más adelante la sesión
// expirada a mitad de uso se resuelve con un modal en vez de un redirect de
// página completa.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEMO_CREDENTIALS } from "../lib/demo-auth";

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoCredentials() {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError(null);
  }

  return (
    <>
      {/* Modo demo: credenciales visibles + botón que rellena el formulario,
          para que probar la app no dependa de tener una cuenta propia. */}
      <div className="rounded-lg border border-[#8b1a1a]/20 bg-[#fff0f0] p-3 space-y-2">
        <p className="text-xs font-medium text-[#8b1a1a]">Modo demo</p>
        <p className="text-xs text-slate-600">
          Correo: <span className="font-medium">{DEMO_CREDENTIALS.email}</span>
          <br />
          Contraseña: <span className="font-medium">{DEMO_CREDENTIALS.password}</span>
        </p>
        <button
          type="button"
          onClick={fillDemoCredentials}
          className="text-xs font-medium text-[#8b1a1a] underline decoration-[#8b1a1a]/40 hover:decoration-[#8b1a1a]"
        >
          Usar cuenta demo
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-[#8b1a1a]">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
            Correo electrónico
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-500 font-medium">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:border-transparent transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#8b1a1a] hover:bg-[#5c1717] text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:ring-offset-2 disabled:opacity-60"
        >
          {submitting ? "Ingresando…" : "Iniciar Sesión"}
        </button>
      </form>
    </>
  );
}

// PIM1-121: formulario de registro, mismo patrón visual que login-form.tsx.
// A diferencia del login (un solo mensaje genérico por seguridad), el
// backend sí devuelve errores por campo (nombre/correo/contraseña), así que
// acá se pintan por separado en vez de un solo banner.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setFieldErrors({ name: err.fields.name, email: err.fields.email, password: err.fields.password });
      } else {
        setGeneralError(err instanceof ApiError ? err.message : "Ocurrió un error inesperado. Intenta de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {generalError && (
        <p role="alert" className="text-sm text-[#8b1a1a]">
          {generalError}
        </p>
      )}

      <div>
        <label htmlFor="register-name" className="block text-sm font-medium text-slate-700 mb-1">
          Nombre
        </label>
        <input
          id="register-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:border-transparent transition-all"
        />
        {fieldErrors.name && (
          <p role="alert" className="mt-1 text-xs text-[#8b1a1a]">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-email" className="block text-sm font-medium text-slate-700 mb-1">
          Correo electrónico
        </label>
        <input
          id="register-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:border-transparent transition-all"
        />
        {fieldErrors.email && (
          <p role="alert" className="mt-1 text-xs text-[#8b1a1a]">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-password" className="block text-sm font-medium text-slate-700 mb-1">
          Contraseña
        </label>
        <input
          id="register-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:border-transparent transition-all"
        />
        {fieldErrors.password && (
          <p role="alert" className="mt-1 text-xs text-[#8b1a1a]">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#8b1a1a] hover:bg-[#5c1717] text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:ring-offset-2 disabled:opacity-60"
      >
        {submitting ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}

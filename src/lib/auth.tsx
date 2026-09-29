// PIM1-42: sesión del organizador. Al montar, pregunta GET /auth/me/ para
// saber si ya hay una sesión válida (cookie httpOnly de Django, nunca se
// guarda nada de esto en localStorage); expone login/logout, que golpean
// POST /auth/login/ y /auth/logout/ y actualizan `user` con la respuesta.
// Si cualquier request 401 a mitad de uso (sesión expirada), api.ts avisa
// acá vía setUnauthorizedHandler y se limpia el usuario + se redirige a
// /login (ver el useEffect de abajo).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setUnauthorizedHandler } from "./api";

export interface AuthUser {
  user_id: number;
  name: string;
  email: string;
  max_daily_hours: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true mientras se resuelve el GET /auth/me/ inicial. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** PIM1-121: POST /auth/register/ crea la cuenta y devuelve el usuario ya logueado (misma sesión que login). */
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    apiFetch<AuthUser>("/auth/me/")
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        // Sin sesión (401) o backend caído: se trata igual, como anónimo.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  async function login(email: string, password: string) {
    const data = await apiFetch<AuthUser>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data);
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiFetch<AuthUser>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setUser(data);
  }

  async function logout() {
    try {
      await apiFetch<void>("/auth/logout/", { method: "POST" });
    } finally {
      // Pase lo que pase con la llamada (idempotente en backend), el
      // usuario deja de verse autenticado en esta pestaña.
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }
  return ctx;
}

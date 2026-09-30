// PIM1-42: sesión del organizador con JWT. El access token vive solo en
// memoria (api.ts, nunca en localStorage) y dura poco; la renovación usa una
// cookie httpOnly `refresh_token` que JS no puede leer. Al montar se llama
// POST /auth/refresh/ (comparte promesa en vuelo, ver refreshSession) para
// recuperar `{user, access}` tras una recarga; login/register reciben la
// misma forma y logout (POST /auth/logout/) limpia token y usuario.
// Si un request 401 no se puede recuperar con refresh, api.ts avisa acá vía
// setUnauthorizedHandler y se limpia el usuario + se redirige a /login.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiFetch,
  bumpSessionEpoch,
  StaleSessionError,
  refreshSession,
  setAccessToken,
  setSessionRefreshedListener,
  setUnauthorizedHandler,
  type AuthSession,
} from "./api";

export interface AuthUser {
  user_id: number;
  name: string;
  email: string;
  max_daily_hours: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true mientras se resuelve el POST /auth/refresh/ inicial. */
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
    refreshSession()
      .then((session) => {
        if (!cancelled) setUser(session.user);
      })
      .catch((err) => {
        // Sin sesión (401), backend caído o 5xx: se trata como anónimo (el
        // token no se toca, así que una petición posterior puede recuperarse
        // con su propio refresh). Un resultado obsoleto (login/logout
        // ocurrió mientras tanto) se ignora para no pisar al usuario actual.
        if (!cancelled && !(err instanceof StaleSessionError)) setUser(null);
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
      bumpSessionEpoch();
      setAccessToken(null);
      setUser(null);
      navigate("/login");
    });
    setSessionRefreshedListener(setUser);
    return () => {
      setUnauthorizedHandler(null);
      setSessionRefreshedListener(null);
    };
  }, [navigate]);

  async function login(email: string, password: string) {
    const data = await apiFetch<AuthSession>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    bumpSessionEpoch();
    setAccessToken(data.access);
    setUser(data.user);
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiFetch<AuthSession>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    bumpSessionEpoch();
    setAccessToken(data.access);
    setUser(data.user);
  }

  async function logout() {
    // Descarta cualquier refresh en vuelo: no debe resucitar la sesión.
    bumpSessionEpoch();
    try {
      await apiFetch<void>("/auth/logout/", { method: "POST" });
    } finally {
      // Pase lo que pase con la llamada (idempotente en backend), el
      // usuario deja de verse autenticado en esta pestaña.
      bumpSessionEpoch();
      setAccessToken(null);
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

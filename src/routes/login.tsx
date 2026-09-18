import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Connect to backend authentication API
    console.log("Logging in with:", { email, password });
    
    // Redirect to home or dashboard on success
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f5f2] px-0">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ¡Bienvenido!
          </h1>
          <p className="text-sm text-slate-500">
            Por favor ingresa tus credenciales.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correo electrónico
            </label>
            <input
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
              <label className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-500 font-medium"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
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
            className="w-full bg-[#8b1a1a] hover:bg-[#5c1717] text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#8b1a1a] focus:ring-offset-2"
          >
            Iniciar Sesión
          </button>
        </form>

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-500">
          ¿No tienes una cuenta?{" "}
          <Link
            to="/register"
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Regístrate
          </Link>
        </p>

      </div>
    </div>
  );
}
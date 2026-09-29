import { Link } from "react-router-dom";
import { LoginForm } from "../components/login-form";

export function LoginPage() {
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

        <LoginForm />

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

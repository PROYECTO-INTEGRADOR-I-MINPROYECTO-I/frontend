import { Link } from "react-router-dom";
import { AuthBrandMark } from "../components/auth-brand-mark";
import { RegisterForm } from "../components/register-form";

export function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f5f2] px-0">
      <AuthBrandMark />
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Crea tu cuenta
          </h1>
          <p className="text-sm text-slate-500">
            Tus eventos y gestiones quedan privados para ti.
          </p>
        </div>

        <RegisterForm />

        {/* Footer Link */}
        <p className="text-center text-xs text-slate-500">
          ¿Ya tienes una cuenta?{" "}
          <Link
            to="/login"
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Inicia sesión
          </Link>
        </p>

      </div>
    </div>
  );
}

// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./routes/homepage";
import { LoginPage }  from "./routes/login";
import { RegisterPage } from "./routes/register";
import { NotFoundPage } from "./routes/not-found";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/protected-route";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
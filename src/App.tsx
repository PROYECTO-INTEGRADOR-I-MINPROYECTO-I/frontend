// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./routes/homepage";
import { LoginPage }  from "./routes/login";
import { AuthProvider } from "./lib/auth";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </AuthProvider>
  );
}
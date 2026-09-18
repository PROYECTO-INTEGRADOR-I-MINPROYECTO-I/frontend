// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { HomePage } from "./routes/homepage";
import { LoginPage }  from "./routes/login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
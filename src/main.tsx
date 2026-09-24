import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router-dom";
import './index.css'
import App from './App.tsx'

// En modo mock, `?mock-reset` se consume (y se quita de la URL) antes de
// montar React: así react-router nunca llega a leerlo y no lo vuelve a
// escribir en la URL en cada setSearchParams (p. ej. al seleccionar un
// evento), que era lo que hacía que el reset se "pegara" en cada recarga.
// Import dinámico gateado por la env var: en builds normales esta rama
// queda muerta y src/mocks/ no entra al bundle.
async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { consumeMockResetParam } = await import("./mocks/store");
    consumeMockResetParam();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
      <App/>
      </BrowserRouter>
    </StrictMode>
  );
}

bootstrap();

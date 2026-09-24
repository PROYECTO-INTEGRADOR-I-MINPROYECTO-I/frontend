# PlanificApp — Frontend

Interfaz de PlanificApp. React 19 + TypeScript + Vite + Tailwind CSS 4. El enrutado usa `react-router-dom`.

## Arranque rápido

```bash
npm install
npm run dev
```

Queda en http://localhost:5173. Requiere el backend corriendo en el puerto 8000.

En local, `npm run dev` carga `.env.development`, donde `VITE_API_URL=/api`: el proxy de Vite (`vite.config.ts`) reenvía esas peticiones al Django de `localhost:8000`, así que el navegador nunca hace una petición cross-origin. Los archivos `.env.dev`, `.env.qa` y `.env.production` son para los builds desplegados y apuntan cada uno a la URL absoluta del backend de su ambiente. Detalle completo en [DEPLOYMENT.md](./DEPLOYMENT.md).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR (modo `development`, usa el proxy de Vite) |
| `npm run build` | Build de producción (modo `production`) |
| `npm run build:qa` | Build del ambiente qa |
| `npm run build:dev` | Build del ambiente dev desplegado |
| `npm run preview` | Sirve el build de producción en local |
| `npm run preview:qa` | Sirve en local el build de qa |
| `npm run lint` | Oxlint |

## Estructura

```
src/
  components/      Componentes de la aplicación
  lib/
    api.ts         Cliente HTTP único hacia el backend
    utils.ts       Utilidades (cn)
  routes/          Pantallas
```

## Llamadas al backend

Todas pasan por `src/lib/api.ts`. No escribir URLs de backend a mano en los componentes: cada ambiente apunta a un dominio distinto y se resuelve por variables de entorno.

```ts
import { apiFetch } from "@/lib/api";

const eventos = await apiFetch<Evento[]>("/eventos/");
```

Cuando el backend responde con error, `apiFetch` lanza un `ApiError` (status, code, fields) en vez del `Error` genérico de `fetch`. En un formulario con react-hook-form se captura así:

```ts
import { ApiError } from "@/lib/api";
import { applyFieldErrors } from "@/lib/form-errors";

try {
  await apiFetch("/eventos/", { method: "POST", body: JSON.stringify(data) });
} catch (error) {
  const pintoCampos = applyFieldErrors(error, form.setError, ["nombre", "fecha"]);
  if (!pintoCampos && error instanceof ApiError) {
    setBanner(error.message);
  }
}
```

## Modo sin backend (mock)

`npm run dev:mock` levanta la app (modo `mock`, carga `.env.mock`) sin necesitar el Django local: `src/lib/api.ts` intercepta cada `apiFetch` y la responde `src/mocks/handler.ts` con datos guardados en `localStorage`, simulando latencia (~400 ms, configurable con `VITE_MOCK_DELAY`) y las mismas validaciones y contratos de error que el backend real. Alcanza para recorrer todo el flujo: crear, editar y eliminar eventos y gestiones, y crear tipos de evento/categorías personalizados.

- `?mock-reset` en la URL reinicia los datos a la semilla inicial (3 eventos con gestiones repartidas entre vencidas, de hoy y próximas). Se consume antes de montar React y se quita de la URL enseguida (`history.replaceState`), así que no se "pega" en las siguientes navegaciones ni recargas.
- `?mock-fail=network` hace fallar las escrituras (POST/PATCH/DELETE) como un error de red.
- `?mock-fail=load` hace fallar las lecturas (GET). A diferencia de `mock-reset`, `mock-fail` sí se queda en la URL mientras lo dejes puesto: es intencional, para poder probar el estado de error navegando o recargando sin tener que volver a escribirlo.

Los builds normales (`npm run build`, `npm run dev`) no incluyen nada de `src/mocks/`: el import es dinámico y solo se ejecuta cuando `VITE_USE_MOCKS=true`, así que Vite lo deja fuera del bundle.

## Despliegue

Tres ambientes (dev, qa, prod) en Render. El detalle completo —variables de entorno, modos de build y configuración de los sitios— está en [DEPLOYMENT.md](./DEPLOYMENT.md).

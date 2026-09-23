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

## Despliegue

Tres ambientes (dev, qa, prod) en Render. El detalle completo —variables de entorno, modos de build y configuración de los sitios— está en [DEPLOYMENT.md](./DEPLOYMENT.md).

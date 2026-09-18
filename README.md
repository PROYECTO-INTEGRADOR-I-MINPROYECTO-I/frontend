# PlanificApp — Frontend

Interfaz de PlanificApp. React 19 + TypeScript + Vite + Tailwind CSS 4, con componentes shadcn/ui.

## Arranque rápido

```bash
npm install
npm run dev
```

Queda en http://localhost:5173. Requiere el backend corriendo en el puerto 8000; el proxy de Vite se encarga del resto.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción |
| `npm run build:qa` | Build del ambiente qa |
| `npm run build:dev` | Build del ambiente dev |
| `npm run preview` | Sirve el build de producción en local |
| `npm run lint` | Oxlint |

## Estructura

```
src/
  components/      Componentes de la aplicación
    ui/            Componentes base (shadcn/ui)
  hooks/           Hooks con la lógica de formularios y llamadas
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

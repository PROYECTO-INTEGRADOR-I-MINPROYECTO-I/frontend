# Despliegue — Frontend

Aplicación React 19 + Vite + Tailwind 4. Se despliega en Render como **Static Site**: el build genera `dist/` y Render lo sirve desde su CDN.

A diferencia del backend, un static site no se suspende por inactividad y no tiene arranque en frío.

---

## 1. Setup local

```bash
npm install
npm run dev
```

Queda en http://localhost:5173.

El backend local debe estar corriendo en el puerto 8000. No hace falta configurar nada más: `vite.config.ts` define un proxy que reenvía todo lo que empiece por `/api` a `http://localhost:8000`. Gracias a eso el navegador nunca hace una petición cross-origin en desarrollo, así que **CORS no interfiere mientras se trabaja en local**.

---

## 2. Variables de entorno

Vite solo expone al cliente las variables con prefijo `VITE_`, y carga el archivo `.env.<modo>` según el modo con que se construya.

> **Todo lo que lleve el prefijo `VITE_` termina escrito en el bundle y es visible para cualquiera que abra el sitio.** Nunca poner ahí claves de API, tokens ni contraseñas. Los secretos van siempre en el backend.

Por eso estos archivos **sí se versionan**: no contienen nada secreto.

| Archivo | Modo | `VITE_API_URL` | Uso |
|---|---|---|---|
| `.env.development` | `development` | `/api` | Solo local (`npm run dev`). Relativo a propósito, para usar el proxy. |
| `.env.dev` | `dev` | `https://planificapp-api-dev.onrender.com/api` | Ambiente dev desplegado. |
| `.env.qa` | `qa` | `https://planificapp-api-qa.onrender.com/api` | Ambiente qa. |
| `.env.production` | `production` | `https://planificapp-api-prod.onrender.com/api` | Producción. |

`.env.development` y `.env.dev` son distintos a propósito y es fácil confundirlos: el proxy de Vite solo existe en el servidor de desarrollo, así que un sitio ya construido **necesita la URL absoluta**. Si se construyera el ambiente dev con `--mode development`, el sitio desplegado pediría `/api` contra su propio dominio y fallaría con 404.

Además existe `VITE_ENVIRONMENT` (`dev` | `qa` | `prod`) por si hace falta condicionar algo en la interfaz. Ambas están tipadas en `src/vite-env.d.ts`.

Para sobrescribir algo solo en la máquina propia, usar `.env.local`, que está en `.gitignore`.

---

## 3. Builds

```bash
npm run build          # producción (modo production)
npm run build:qa       # modo qa
npm run build:dev      # modo dev
npm run preview:qa     # sirve el build de qa en local para revisarlo
```

Todos generan `dist/`.

---

## 4. Llamadas a la API

**Toda petición HTTP pasa por `src/lib/api.ts`.** Nunca escribir una URL de backend a mano en un componente: rompe los tres ambientes de golpe, porque el componente quedaría atado a un dominio fijo.

```ts
import { apiFetch } from "@/lib/api";

const data = await apiFetch<Evento[]>("/eventos/");
```

`apiFetch` ya resuelve la URL base según el ambiente, manda `Content-Type: application/json`, incluye las cookies (`credentials: "include"`, necesario para la autenticación por sesión) y lanza un `Error` si la respuesta no es exitosa.

---

## 5. Despliegue en Render

El repositorio incluye `render.yaml` con los tres sitios definidos.

1. En Render: **New → Blueprint** y conectar este repositorio.
2. Render propone `planificapp-web-dev`, `planificapp-web-qa` y `planificapp-web-prod`, cada uno atado a su rama.

| Ambiente | Rama | Sitio | Modo de build |
|---|---|---|---|
| dev | `develop` | `planificapp-web-dev` | `dev` |
| qa | `qa` | `planificapp-web-qa` | `qa` |
| prod | `main` | `planificapp-web-prod` | `production` |

No hay variables que cargar en el dashboard: al ser un sitio estático, la configuración queda fijada en el bundle en tiempo de build, leída de los archivos `.env.*` del repositorio.

Cada sitio incluye una regla de rewrite `/*` → `/index.html`. Es obligatoria: sin ella, recargar el navegador en cualquier ruta que no sea la raíz devuelve 404, porque el enrutado ocurre del lado del cliente y Render buscaría un archivo que no existe.

---

## 6. Coordinación con el backend

Los dominios tienen que coincidir en ambos lados o las peticiones se bloquean:

- El `VITE_API_URL` de cada `.env.*` apunta al backend de **ese mismo** ambiente.
- El `CORS_ALLOWED_ORIGINS` del backend de ese ambiente debe incluir el dominio de **este** sitio.

Si Render asigna un nombre distinto al previsto (pasa cuando el nombre ya está tomado), hay que actualizar las dos puntas.

---

## 7. Problemas frecuentes

**`Access to fetch ... has been blocked by CORS policy`** — el dominio de este sitio no está en el `CORS_ALLOWED_ORIGINS` del backend. Se arregla del lado del backend, no aquí.

**404 al recargar una ruta interna** — falta la regla de rewrite en la configuración del static site.

**El sitio desplegado pide `/api/...` contra su propio dominio** — se construyó con el modo equivocado (`development` en vez de `dev`). Revisar el `buildCommand` del sitio.

**La primera petición al backend tarda muchísimo** — es el arranque en frío del web service del backend en el plan free, no un problema del frontend.

---

## Pendiente del equipo

**Conectar el login al backend.** `src/routes/login.tsx` es la pantalla de login en uso, pero todavía es autocontenida: el `handleSubmit` no llama al backend. Mientras ningún componente use `src/lib/api.ts`, ese módulo no entra al bundle y los tres modos de build generan un artefacto idéntico. En cuanto se conecte la primera llamada, cada ambiente empezará a incluir su propia `VITE_API_URL`.

Django hoy solo expone `/api/test/` y `/api/health/`, no hay endpoints de autenticación. Hay que definir las rutas, si la sesión va por cookie o por token, y qué ocurre tras un login exitoso, y usar `apiFetch` de `src/lib/api.ts` para no atar el código a un dominio fijo.

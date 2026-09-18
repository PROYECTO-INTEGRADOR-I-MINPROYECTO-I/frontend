// Cliente HTTP único para hablar con el backend.
// Centraliza la URL base, las cabeceras por defecto y el manejo de errores.

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error(
    "VITE_API_URL no está definida. Revisa el archivo .env correspondiente al ambiente."
  );
}

/**
 * Hace una petición al backend y devuelve el cuerpo ya parseado como JSON.
 * Fusiona los headers recibidos con los headers por defecto y envía
 * credenciales (cookies) en cada request.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Error ${response.status}: ${body || response.statusText}`);
  }

  // Respuestas sin contenido (204) o con cuerpo vacío no se pueden parsear como JSON.
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

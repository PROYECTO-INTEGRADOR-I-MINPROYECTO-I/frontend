// Cliente HTTP único para hablar con el backend.
// Centraliza la URL base, las cabeceras por defecto y el manejo de errores.

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error(
    "VITE_API_URL no está definida. Revisa el archivo .env correspondiente al ambiente."
  );
}

// Error estructurado para que las vistas puedan pintar mensajes por campo
// sin tener que parsear el cuerpo de la respuesta cada una por su cuenta.
export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: string,
    fields: Record<string, string> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Mensajes genéricos por status cuando el backend no manda un cuerpo útil.
function defaultMessageFor(status: number): { code: string; message: string } {
  if (status === 400) {
    return { code: "VALIDATION_ERROR", message: "Revisa los campos marcados." };
  }
  if (status === 404) {
    return { code: "NOT_FOUND", message: "No encontramos lo que buscabas." };
  }
  if (status === 409) {
    return { code: "CONFLICT", message: "Ese registro ya existe o entra en conflicto con otro." };
  }
  if (status >= 500) {
    return { code: "SERVER_ERROR", message: "Ocurrió un error en el servidor. Intenta de nuevo más tarde." };
  }
  // Cubre también el caso de un detail anidado (objeto en vez de string): no hay
  // forma genérica de mostrarlo, así que se cae en el mensaje por status.
  return { code: "HTTP_ERROR", message: "Algo salió mal al procesar la solicitud." };
}

// Los arrays también son "object" para typeof, pero acá nos interesan solo los
// objetos planos que podemos recorrer como mapa de campos.
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Contrato acordado (TS-03): { error: { code, message, fields } }.
function buildFromAgreedContract(
  errorBody: Record<string, unknown>,
  status: number,
  fallback: { code: string; message: string }
): ApiError {
  const code = typeof errorBody.code === "string" ? errorBody.code : fallback.code;
  const message = typeof errorBody.message === "string" ? errorBody.message : fallback.message;
  const fields: Record<string, string> = {};
  if (isRecord(errorBody.fields)) {
    for (const [field, value] of Object.entries(errorBody.fields)) {
      if (typeof value === "string") {
        fields[field] = value;
      }
    }
  }
  return new ApiError(message, status, code, fields);
}

// Aplana errores anidados de DRF (objetos dentro de objetos) a notación de
// punto, que es la que usa react-hook-form para nombrar campos anidados.
function flattenDrfFieldErrors(
  value: unknown,
  path: string,
  fields: Record<string, string>
): void {
  if (typeof value === "string") {
    fields[path] = value;
    return;
  }
  if (Array.isArray(value)) {
    if (typeof value[0] === "string") {
      fields[path] = value[0];
    }
    return;
  }
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      flattenDrfFieldErrors(nested, `${path}.${key}`, fields);
    }
  }
}

// Formato por defecto de DRF: { campo: ["mensaje", ...] } / detail / non_field_errors.
function buildFromDrfBody(
  body: Record<string, unknown>,
  status: number,
  fallback: { code: string; message: string }
): ApiError | undefined {
  const fields: Record<string, string> = {};
  let message: string | undefined;

  for (const [key, value] of Object.entries(body)) {
    if (key === "detail" && typeof value === "string") {
      message = value;
      continue;
    }
    if (key === "non_field_errors") {
      if (Array.isArray(value) && typeof value[0] === "string") {
        message = value[0];
      }
      continue;
    }
    flattenDrfFieldErrors(value, key, fields);
  }

  // Si además de los campos vino un mensaje general (detail o non_field_errors),
  // se conserva en vez del texto genérico de validación.
  if (Object.keys(fields).length > 0) {
    return new ApiError(
      message ?? "Revisa los campos marcados.",
      status,
      "VALIDATION_ERROR",
      fields
    );
  }
  if (message) {
    return new ApiError(message, status, fallback.code, {});
  }
  return undefined;
}

function buildApiErrorFromBody(body: unknown, status: number): ApiError {
  const fallback = defaultMessageFor(status);

  if (isRecord(body) && isRecord(body.error)) {
    return buildFromAgreedContract(body.error, status, fallback);
  }

  if (isRecord(body)) {
    const error = buildFromDrfBody(body, status, fallback);
    if (error) return error;
  }

  return new ApiError(fallback.message, status, fallback.code, {});
}

async function buildApiError(response: Response): Promise<ApiError> {
  const text = await response.text();
  if (!text) {
    const fallback = defaultMessageFor(response.status);
    return new ApiError(fallback.message, response.status, fallback.code, {});
  }

  try {
    const body = JSON.parse(text);
    return buildApiErrorFromBody(body, response.status);
  } catch {
    const fallback = defaultMessageFor(response.status);
    return new ApiError(fallback.message, response.status, fallback.code, {});
  }
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
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (err) {
    // Un abort (por ejemplo un AbortController del caller) no es una falla de
    // red: se re-lanza tal cual para que quien canceló lo maneje a su modo.
    if ((err instanceof DOMException || err instanceof Error) && err.name === "AbortError") {
      throw err;
    }
    // El resto de fallas de fetch son de red (sin conexión, CORS, DNS, etc.).
    throw new ApiError(
      "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
      0,
      "NETWORK_ERROR"
    );
  }

  if (!response.ok) {
    throw await buildApiError(response);
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

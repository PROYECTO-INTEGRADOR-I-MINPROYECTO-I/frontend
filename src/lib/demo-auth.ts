// El backend todavía no tiene endpoint de login (solo eventos, subtareas y
// usuarios), así que el acceso funciona con una única cuenta demo mientras
// no exista autenticación real.
//
// TODO(backend): reemplazar por una llamada real al endpoint de login cuando
// exista, y quitar este módulo.

export const DEMO_CREDENTIALS = {
  email: "demo@planificapp.com",
  password: "demo1234",
};

export function isDemoLogin(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail === DEMO_CREDENTIALS.email.toLowerCase() && password === DEMO_CREDENTIALS.password;
}

export type Role = "admin" | "manager";

const ADMIN_ONLY_PREFIXES = ["/settings", "/dashboard"];

// Rutas accesibles sin sesión: /login, el callback de invitación/recovery
// (procesa el token del fragmento de la URL en el cliente antes de que
// exista una sesión), y toda /api/* — las rutas de API manejan su propia
// autorización (sesión admin, o CRON_SECRET para operaciones internas como
// /api/sync-reviews) y deben poder responder JSON (401/403), no un redirect
// a la página de login.
const PUBLIC_PREFIXES = ["/login", "/auth/callback", "/api"];

/** Determina si una ruta (ya autenticada) requiere rol admin. */
export function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Determina si una ruta es accesible sin sesión iniciada. */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Puro: dado un rol y una ruta, ¿se le permite el acceso? */
export function canAccessRoute(role: Role | undefined, pathname: string): boolean {
  if (isAdminOnlyRoute(pathname)) {
    return role === "admin";
  }
  return true;
}

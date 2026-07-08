import { describe, expect, it } from "vitest";
import { canAccessRoute, isAdminOnlyRoute, isPublicRoute } from "@/lib/auth/route-access";

describe("isAdminOnlyRoute", () => {
  it("marca /settings y /dashboard como admin-only", () => {
    expect(isAdminOnlyRoute("/settings")).toBe(true);
    expect(isAdminOnlyRoute("/settings/users")).toBe(true);
    expect(isAdminOnlyRoute("/dashboard")).toBe(true);
  });

  it("no marca otras rutas como admin-only", () => {
    expect(isAdminOnlyRoute("/")).toBe(false);
    expect(isAdminOnlyRoute("/checkin")).toBe(false);
  });
});

describe("canAccessRoute", () => {
  it("admin accede a rutas admin-only", () => {
    expect(canAccessRoute("admin", "/settings")).toBe(true);
    expect(canAccessRoute("admin", "/dashboard")).toBe(true);
  });

  it("manager NO accede a rutas admin-only", () => {
    expect(canAccessRoute("manager", "/settings")).toBe(false);
    expect(canAccessRoute("manager", "/dashboard")).toBe(false);
  });

  it("manager accede a rutas comunes", () => {
    expect(canAccessRoute("manager", "/")).toBe(true);
    expect(canAccessRoute("manager", "/checkin")).toBe(true);
  });

  it("sin rol definido no accede a rutas admin-only", () => {
    expect(canAccessRoute(undefined, "/settings")).toBe(false);
  });
});

describe("isPublicRoute", () => {
  it("marca /login, /auth/callback y /api/* como públicas", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/auth/callback")).toBe(true);
    expect(isPublicRoute("/api/sync-reviews")).toBe(true);
    expect(isPublicRoute("/api/invite")).toBe(true);
  });

  it("no marca rutas de la app (no-API) como públicas", () => {
    expect(isPublicRoute("/")).toBe(false);
    expect(isPublicRoute("/branches")).toBe(false);
    expect(isPublicRoute("/set-password")).toBe(false);
  });
});

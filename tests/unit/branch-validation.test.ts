import { describe, expect, it } from "vitest";
import { validateBranch } from "@/lib/validation/branch";

describe("validateBranch", () => {
  it("requiere nombre", () => {
    const errors = validateBranch({ name: "", googlePlaceId: "abc123" }, []);
    expect(errors.name).toBeDefined();
    expect(errors.googlePlaceId).toBeUndefined();
  });

  it("requiere google place id", () => {
    const errors = validateBranch({ name: "Sucursal Centro", googlePlaceId: "" }, []);
    expect(errors.googlePlaceId).toBeDefined();
  });

  it("rechaza un place id ya usado en la misma org", () => {
    const errors = validateBranch(
      { name: "Sucursal Centro", googlePlaceId: "abc123" },
      ["abc123", "xyz789"],
    );
    expect(errors.googlePlaceId).toBeDefined();
  });

  it("acepta datos válidos y únicos", () => {
    const errors = validateBranch(
      { name: "Sucursal Centro", googlePlaceId: "nuevo-id" },
      ["abc123", "xyz789"],
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

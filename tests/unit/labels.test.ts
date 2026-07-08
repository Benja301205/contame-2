import { describe, expect, it } from "vitest";
import { PROBLEM_CATEGORIES } from "@/lib/analysis/classify";
import { CATEGORY_LABELS, categoryLabel, severityLabel } from "@/lib/labels";

describe("CATEGORY_LABELS", () => {
  it("traduce cada categoría del catálogo, sin slugs con guión bajo", () => {
    for (const category of PROBLEM_CATEGORIES) {
      const label = categoryLabel(category);
      expect(label).not.toContain("_");
      expect(label).toBe(CATEGORY_LABELS[category]);
    }
  });

  it("categoryLabel devuelve el valor tal cual si no reconoce la categoría", () => {
    expect(categoryLabel("no-existe")).toBe("no-existe");
  });
});

describe("severityLabel", () => {
  it("traduce 1/2/3 a Menor/Importante/Grave", () => {
    expect(severityLabel(1)).toBe("Menor");
    expect(severityLabel(2)).toBe("Importante");
    expect(severityLabel(3)).toBe("Grave");
  });
});

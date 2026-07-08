import { describe, expect, it } from "vitest";
import { classifyByRatingOnly, parseClassifyResponse } from "@/lib/analysis/classify";

describe("classifyByRatingOnly", () => {
  it("rating 1-2 → negative, sin llamar a la API", () => {
    expect(classifyByRatingOnly("r1", 1)).toMatchObject({ sentiment: "negative", categories: [] });
    expect(classifyByRatingOnly("r2", 2)).toMatchObject({ sentiment: "negative", categories: [] });
  });

  it("rating 3 → neutral", () => {
    expect(classifyByRatingOnly("r3", 3)).toMatchObject({ sentiment: "neutral", categories: [] });
  });

  it("rating 4-5 → positive", () => {
    expect(classifyByRatingOnly("r4", 4)).toMatchObject({ sentiment: "positive", categories: [] });
    expect(classifyByRatingOnly("r5", 5)).toMatchObject({ sentiment: "positive", categories: [] });
  });

  it("nunca menciona compensación y siempre trae categorías vacías", () => {
    const result = classifyByRatingOnly("r1", 1);
    expect(result.mentionsCompensation).toBe(false);
    expect(result.categories).toEqual([]);
  });
});

describe("parseClassifyResponse", () => {
  it("parsea un JSON válido con un solo resultado", () => {
    const raw = JSON.stringify({
      results: [
        {
          review_id: "abc",
          sentiment: "negative",
          categories: ["demora"],
          severity: 2,
          mentions_compensation: false,
          summary: "El cliente esperó mucho.",
        },
      ],
    });

    const { valid, invalid } = parseClassifyResponse(raw);

    expect(invalid).toHaveLength(0);
    expect(valid.get("abc")).toMatchObject({
      reviewId: "abc",
      sentiment: "negative",
      categories: ["demora"],
      severity: 2,
    });
  });

  it("lanza un error si el texto no es JSON", () => {
    expect(() => parseClassifyResponse("esto no es JSON")).toThrow(/JSON válido/);
  });

  it("lanza un error si falta la clave 'results'", () => {
    expect(() => parseClassifyResponse(JSON.stringify({ foo: "bar" }))).toThrow(/forma esperada/);
  });

  it("una categoría fuera del catálogo invalida SOLO ese item, no el resto del lote", () => {
    const raw = JSON.stringify({
      results: [
        {
          review_id: "bueno",
          sentiment: "positive",
          categories: [],
          severity: 1,
          mentions_compensation: false,
          summary: "Todo bien.",
        },
        {
          review_id: "malo",
          sentiment: "negative",
          categories: ["categoria_inventada"],
          severity: 2,
          mentions_compensation: false,
          summary: "Reseña con categoría inválida.",
        },
      ],
    });

    const { valid, invalid } = parseClassifyResponse(raw);

    expect(valid.get("bueno")).toBeDefined();
    expect(valid.get("malo")).toBeUndefined();
    expect(invalid).toHaveLength(1);
    expect(invalid[0].reviewId).toBe("malo");
  });

  it("un item sin campos requeridos también se reporta como inválido sin tirar el resto", () => {
    const raw = JSON.stringify({
      results: [
        { review_id: "incompleto", sentiment: "positive" },
        {
          review_id: "completo",
          sentiment: "neutral",
          categories: [],
          severity: 1,
          mentions_compensation: false,
          summary: "Ok.",
        },
      ],
    });

    const { valid, invalid } = parseClassifyResponse(raw);

    expect(valid.get("completo")).toBeDefined();
    expect(valid.has("incompleto")).toBe(false);
    expect(invalid.some((i) => i.reviewId === "incompleto")).toBe(true);
  });

  it("trunca el summary a 120 caracteres", () => {
    const longSummary = "a".repeat(200);
    const raw = JSON.stringify({
      results: [
        {
          review_id: "largo",
          sentiment: "neutral",
          categories: [],
          severity: 1,
          mentions_compensation: false,
          summary: longSummary,
        },
      ],
    });

    const { valid } = parseClassifyResponse(raw);
    expect(valid.get("largo")!.summary).toHaveLength(120);
  });
});

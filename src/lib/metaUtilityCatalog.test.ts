import { describe, it, expect } from "vitest";
import { catalogoUtility } from "./metaUtilityCatalog";

describe("catalogoUtility amostra", () => {
  it("usa a cópia aprovada com texto quando a primeira está vazia", () => {
    const base = { nome_template: "lembrete_pagamento", idioma: "pt_BR", categoria: "UTILITY", status: "approved" };
    const copies = [
      { ...base, id: "a", instancia_id: "i1", body_text: "" },
      { ...base, id: "b", instancia_id: "i2", body_text: "Olá {{1}}" },
    ] as any[];
    const [g] = catalogoUtility(copies, [], "u", ["i1", "i2"], [], () => 1);
    expect(g.sample.body_text).toBe("Olá {{1}}");
  });
});

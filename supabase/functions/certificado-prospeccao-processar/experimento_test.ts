import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  dataUmAnoAntes,
  etapaCertificado,
} from "../_shared/certificado-experimento.ts";

Deno.test("piloto anual usa a mesma data um ano antes", () => {
  assertEquals(dataUmAnoAntes("2026-09-28"), "2025-09-28");
  assertEquals(dataUmAnoAntes("2026-10-02"), "2025-10-02");
  assertEquals(etapaCertificado("2026-09-28"), {
    janela: 365,
    ciclo: 0,
    dataAlvo: "2025-09-28",
    tipo: "renovacao_anual",
  });
});

Deno.test("piloto anual encerra sem retomar o ciclo antigo", () => {
  assertEquals(etapaCertificado("2026-10-03"), null);
});
import { describe, it, expect } from "vitest";
import { parcelaJaPaga } from "../../supabase/functions/_shared/parcela-ja-paga";

const pagas = [{ cpf: "70732394252", empresa: "odres_cred", data_prevista: "2026-11-07", data_paga: "2026-11-07" }];

describe("parcelaJaPaga", () => {
  it("pula parcela paga em acordo duplicado com o mesmo vencimento", () => {
    expect(parcelaJaPaga(pagas, "707.323.942-52", "odres_cred", "2026-11-07", "2026-12")).toBe(true);
  });
  it("pula quem já pagou parcela no mês corrente", () => {
    expect(parcelaJaPaga(pagas, "70732394252", "odres_cred", "2026-11-20", "2026-11")).toBe(true);
  });
  it("não pula se o pagamento é de outro credor", () => {
    expect(parcelaJaPaga(pagas, "70732394252", "ume_novo_mundo", "2026-11-07", "2026-11")).toBe(false);
  });
  it("não pula sem pagamento no vencimento nem no mês", () => {
    expect(parcelaJaPaga(pagas, "70732394252", "odres_cred", "2026-12-07", "2026-12")).toBe(false);
  });
});
